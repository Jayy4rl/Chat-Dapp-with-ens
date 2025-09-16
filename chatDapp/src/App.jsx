import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, User, Wallet, Send, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import ENS_CONTRACT_ABI from "./constants/ENS_ABI.json"
import CHAT_CONTRACT_ABI from "./constants/Chat_ABI.json"

const ENS_CONTRACT_ADDRESS = "0x99a1Ade794A78a31Eb5B7393fa39cd0Ee3843c8C";
const CHAT_CONTRACT_ADDRESS = "0x6900E41257aB091d5950A5910d939E8B8E5C8D4F";

const Web3ChatENS = () => {
  // Wallet connection state
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  // Contract state
  const [ensContract, setEnsContract] = useState(null);
  const [chatContract, setChatContract] = useState(null);
  const [registrationFee, setRegistrationFee] = useState('0');

  // App state
  const [customName, setCustomName] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [registrationInput, setRegistrationInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

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

      // Get registration fee
      try {
        const fee = await ens.registrationFee();
        setRegistrationFee(fee.toString());
      } catch (err) {
        console.log('Could not fetch registration fee:', err);
      }

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
      
      // Check if name is available
      const isNameTaken = await ensContract.usernameExist(name);
      if (isNameTaken) {
        setError('This name is already taken');
        return;
      }

      // Register name (using a default avatar for now)
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

      // For this example, we're sending to a general chat address
      // In a real app, you'd want to implement recipient selection
      const GENERAL_CHAT = "general";
      
      // Send message using the contract's sendMessage function
      // Parameters: from (address), message (string), to (string - ENS name)
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <MessageCircle className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Web3 Chat dApp</h1>
            <p className="text-gray-600">Connect your wallet to start chatting with custom ENS names</p>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-3">
            {wallets.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                <p className="text-gray-500">Detecting wallets...</p>
              </div>
            ) : (
              wallets.map((wallet, index) => (
                <button
                  key={index}
                  onClick={() => connectWallet(wallet)}
                  className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <img 
                    src={wallet.info.icon} 
                    alt={wallet.info.name} 
                    className="w-8 h-8"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIGZpbGw9IiNGM0Y0RjYiLz48L3N2Zz4=';
                    }}
                  />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">{wallet.info.name}</div>
                  </div>
                </button>
              ))
            )}
          </div>
          
          {wallets.length === 0 && (
            <p className="text-xs text-gray-500 text-center mt-4">
              Make sure you have a Web3 wallet installed (MetaMask, Rainbow, etc.)
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-8 h-8 text-indigo-600" />
              <h1 className="text-xl font-bold text-gray-900">Web3 Chat dApp</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {customName ? `${customName}.myens` : 'No ENS name'}
                </div>
                <div className="text-xs text-gray-500">
                  {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                </div>
              </div>
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <button
                onClick={disconnectWallet}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Panel */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Register ENS Name
          </h2>
          
          {!customName ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose your custom name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={registrationInput}
                    onChange={(e) => setRegistrationInput(e.target.value)}
                    placeholder="myname"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isRegistering}
                  />
                  <span className="flex items-center text-gray-500 text-sm">.myens</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Registration fee: 0.01 ETH
                </p>
              </div>
              
              <button
                onClick={registerName}
                disabled={isRegistering || !registrationInput.trim()}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  'Register Name'
                )}
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-medium text-gray-900 mb-1">Name Registered!</h3>
              <p className="text-sm text-gray-600">{customName}.myens</p>
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-green-700 text-sm">{success}</span>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm flex flex-col h-96">
          {/* Chat Header */}
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">General Chat</h2>
            <p className="text-sm text-gray-500">Chat with your custom ENS name on-chain</p>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm">
                        {message.sender}
                      </span>
                      <span className="text-xs text-gray-500">{message.timestamp}</span>
                    </div>
                    <p className="text-gray-800 text-sm">{message.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Message Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isSending && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isSending}
              />
              <button
                onClick={sendMessage}
                disabled={isSending || !newMessage.trim()}
                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Web3ChatENS;