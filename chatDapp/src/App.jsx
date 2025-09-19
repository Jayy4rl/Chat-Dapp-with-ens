import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, User, Wallet, Send, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import ENS_CONTRACT_ABI from "./constants/ENS_ABI.json"
import CHAT_CONTRACT_ABI from "./constants/Chat_ABI.json"

function App() {
  // Wallet connection state
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  // Reference for message container to auto-scroll to bottom
  const messagesEndRef = useRef(null);

  // Contract state
  const [ensContract, setEnsContract] = useState(null);
  const [chatContract, setChatContract] = useState(null);

  // App state
  const [customName, setCustomName] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [registrationInput, setRegistrationInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const ENS_CONTRACT_ADDRESS = "0xaBe6D4e4B136eca99A3bB8A8674A9a7630f497D2";
  const CHAT_CONTRACT_ADDRESS = "0x238b74368fD057AEc35Bc7D692483a2A24994EB1";

  // EIP-6963: Detect available wallets
  const detectWallets = useCallback(() => {
    const discoveredWallets = [];

    const handleWalletAnnouncement = (event) => {
      discoveredWallets.push(event.detail);
      setWallets([...discoveredWallets]);
    };

    window.addEventListener('eip6963:announceProvider', handleWalletAnnouncement);

    window.dispatchEvent(new Event('eip6963:requestProvider'));

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleWalletAnnouncement);
    };
  }, []);

  // Initialize wallet detection
  useEffect(() => {
    const cleanup = detectWallets();
    return cleanup;
  }, [detectWallets]);

  // Connect to selected wallet
  const connectWallet = async (wallet) => {
    try {
      setError(null);
      
      // Import ethers dynamically
      const { BrowserProvider, Contract } = await import('ethers');
      
      // Request account access
      await wallet.provider.request({ method: 'eth_requestAccounts' });
      
      // Create provider and signer
      const ethersProvider = new BrowserProvider(wallet.provider);
      const ethersSigner = await ethersProvider.getSigner();
      const address = await ethersSigner.getAddress();
      
      // Set wallet state
      setSelectedWallet(wallet);
      setProvider(ethersProvider);
      setSigner(ethersSigner);
      setUserAddress(address);
      setIsConnected(true);

      // Initialize contracts
      const ens = new Contract(ENS_CONTRACT_ADDRESS, ENS_CONTRACT_ABI, ethersSigner);
      const chat = new Contract(CHAT_CONTRACT_ADDRESS, CHAT_CONTRACT_ABI, ethersSigner);
      
      setEnsContract(ens);
      setChatContract(chat);

      // Check if user already has a registered name
      try {
        const userInfo = await ens.getUserFromAddress(address);
        if (userInfo && userInfo.name) {
          setCustomName(userInfo.name);
        }
      } catch (err) {
        console.log('No existing name found', err);
      }

      // Load initial messages
      loadMessages();

      // Listen for new messages
      listenForMessages(chat);

    } catch (err) {
      setError('Failed to connect wallet: ' + err.message);
      console.error('Wallet connection error:', err);
    }
  };

  // Load chat messages
  const loadMessages = async () => {
    if (!chatContract || !ensContract) return;

    try {
      const messages = await chatContract.getUserMessages();
      
      const formattedMessages = await Promise.all(
        messages.map(async (msg) => {
          // Get sender's ENS name
          const senderInfo = await ensContract.getUserFromAddress(msg.from);
          // Get recipient's ENS name
          const recipientInfo = await ensContract.getUserFromAddress(msg.to);
          
          return {
            id: msg.from + msg.to + msg.message, // Create a unique ID from message data
            sender: senderInfo.name || `${msg.from.slice(0, 6)}...${msg.from.slice(-4)}`,
            recipient: recipientInfo.name || `${msg.to.slice(0, 6)}...${msg.to.slice(-4)}`,
            senderAddress: msg.from,
            recipientAddress: msg.to,
            content: msg.message,
            timestamp: new Date().toLocaleTimeString() // Since timestamp isn't in the contract
          };
        })
      );

      setMessages(formattedMessages);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  // Listen for new messages
  const listenForMessages = (contract) => {
    if (!contract || !ensContract) return;

    const filter = contract.filters.MessageSent();
    contract.on(filter, async (from, to, message, event) => {
      try {
        // Get sender's ENS name
        const senderInfo = await ensContract.getUserFromAddress(from);
        // Get recipient's ENS name
        const recipientInfo = await ensContract.getUserFromAddress(to);

        const newMessage = {
          id: event.log.transactionHash + event.log.logIndex,
          sender: senderInfo.name || `${from.slice(0, 6)}...${from.slice(-4)}`,
          recipient: recipientInfo.name || `${to.slice(0, 6)}...${to.slice(-4)}`,
          senderAddress: from,
          recipientAddress: to,
          content: message,
          timestamp: new Date().toLocaleTimeString()
        };
        
        setMessages(prev => [...prev, newMessage]);
      } catch (err) {
        console.error('Error processing new message:', err);
      }
    });
  };

  // Register custom name
  const registerName = async () => {
    if (!ensContract || !registrationInput.trim()) {
      setError('Please enter a name');
      return;
    }

    try {
      setError(null);
      setSuccess('');
      setIsRegistering(true);

      const name = registrationInput.trim().toLowerCase();
      

      const defaultAvatar = "https://api.dicebear.com/6.x/identicon/svg?seed=" + name;
      const tx = await ensContract.createAccount(userAddress, defaultAvatar, name);
      
      setSuccess('Transaction submitted! Waiting for confirmation...');
      
      // Wait for transaction confirmation
      await tx.wait();
      
      setCustomName(name);
      setRegistrationInput('');
      setSuccess(`Successfully registered ${name}.myens!`);
      
    } catch (err) {
      setError('Registration failed: ' + err.message);
      console.error('Registration error:', err);
    } finally {
      setIsRegistering(false);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!chatContract || !newMessage.trim() || !customName) {
      setError('Please register an ENS name before sending messages');
      return;
    }

    try {
      setError(null);
      setIsSending(true);

      const GENERAL_CHAT = "general";
      
      const tx = await chatContract.sendMessage(
        userAddress,
        newMessage.trim(),
        GENERAL_CHAT
      );
      
      setNewMessage('');
      await tx.wait();
      
      // Refresh messages after sending
      await loadMessages();
      
    } catch (err) {
      setError('Failed to send message: ' + err.message);
      console.error('Send message error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setSelectedWallet(null);
    setProvider(null);
    setSigner(null);
    setUserAddress('');
    setIsConnected(false);
    setEnsContract(null);
    setChatContract(null);
    setCustomName('');
    setMessages([]);
  };

  // Wallet selection screen
  if (!isConnected) {
    return (
      <div className="container">
        <div className="wallet-section">
          <h1>Web3 Chat dApp</h1>
          <p>Connect your wallet to start chatting with custom ENS names</p>
          
          {error && (
            <div className="error">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="wallet-list">
            {wallets.length === 0 ? (
              <div className="loading">
                <Loader2 className="w-8 h-8" />
                <p>Detecting wallets...</p>
              </div>
            ) : (
              wallets.map((wallet, index) => (
                <button
                  key={index}
                  onClick={() => connectWallet(wallet)}
                  className="wallet-button"
                >
                  <img 
                    src={wallet.info.icon} 
                    alt={wallet.info.name} 
                    className="w-8 h-8"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIGZpbGw9IiNGM0Y0RjYiLz48L3N2Zz4=';
                    }}
                  />
                  <span>{wallet.info.name}</span>
                </button>
              ))
            )}
          </div>
          
          {wallets.length === 0 && (
            <p>Make sure you have a Web3 wallet installed (MetaMask, Rainbow, etc.)</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="wallet-section">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6" />
            <h1>Web3 Chat dApp</h1>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <div>
                {customName ? `${customName}.myens` : 'No ENS name'}
              </div>
              <div className="text-sm opacity-75">
                {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
              </div>
            </div>
            <button
              onClick={disconnectWallet}
              className="wallet-button"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <div className="registration-section">
        <h2>
          <CheckCircle className="w-5 h-5" />
          Register ENS Name
        </h2>
        
        {!customName ? (
          <div>
            <div className="input-group">
              <input
                type="text"
                value={registrationInput}
                onChange={(e) => setRegistrationInput(e.target.value)}
                placeholder="Enter your desired name"
                disabled={isRegistering}
              />
              <button
                className="wallet-button"
                onClick={registerName}
                disabled={isRegistering || !registrationInput.trim()}
              >
                {isRegistering ? (
                  <div className="loading">
                    <Loader2 className="w-4 h-4" />
                    <span>Registering...</span>
                  </div>
                ) : (
                  'Register Name'
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="success">
            <CheckCircle className="w-5 h-5" />
            <p>Registered as: {customName}.myens</p>
          </div>
        )}

        {/* Status Messages */}
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
      </div>

      {/* Chat Section */}
      <div className="chat-section">
        <div className="messages-container" ref={messagesEndRef}>
          {messages.length === 0 ? (
            <div className="text-center">
              <MessageCircle className="w-8 h-8" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`message ${
                  message.senderAddress === userAddress ? 'sent' : 'received'
                }`}
              >
                <p className="text-sm">{message.sender}</p>
                <p>{message.content}</p>
                <p className="text-xs opacity-75">{message.timestamp}</p>
              </div>
            ))
          )}
        </div>

        <div className="message-input">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isSending && sendMessage()}
            placeholder="Type your message..."
            disabled={isSending}
          />
          <button
            className="send-button"
            onClick={sendMessage}
            disabled={isSending || !newMessage.trim()}
          >
            {isSending ? (
              <Loader2 className="w-4 h-4" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;