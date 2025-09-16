import React, { useState, useEffect } from 'react';
import { MessageCircle, User, Wallet, Send, CheckCircle } from 'lucide-react';

const SimpleChatENS = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [customName, setCustomName] = useState('');
  const [registeredNames, setRegisteredNames] = useState({});
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [registrationInput, setRegistrationInput] = useState('');

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedNames = localStorage.getItem('registeredNames');
    const savedMessages = localStorage.getItem('chatMessages');
    
    if (savedNames) {
      setRegisteredNames(JSON.parse(savedNames));
    }
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
  }, []);

  // Simulate wallet connection
  const connectWallet = () => {
    // Generate a mock wallet address
    const mockAddress = '0x' + Math.random().toString(16).substr(2, 40);
    setUserAddress(mockAddress);
    setIsConnected(true);
    
    // Check if this address already has a registered name
    const existingName = Object.keys(registeredNames).find(
      name => registeredNames[name] === mockAddress
    );
    if (existingName) {
      setCustomName(existingName);
    }
  };

  // Register a custom ENS name
  const registerName = () => {
    if (!registrationInput.trim()) {
      alert('Please enter a name');
      return;
    }

    const nameToRegister = registrationInput.trim().toLowerCase();
    
    // Check if name is already taken
    if (registeredNames[nameToRegister]) {
      alert('This name is already taken!');
      return;
    }

    // Register the name
    const newRegisteredNames = {
      ...registeredNames,
      [nameToRegister]: userAddress
    };
    
    setRegisteredNames(newRegisteredNames);
    setCustomName(nameToRegister);
    setRegistrationInput('');
    
    // Save to localStorage
    localStorage.setItem('registeredNames', JSON.stringify(newRegisteredNames));
    
    alert(`Successfully registered ${nameToRegister}.myens!`);
  };

  // Send a message
  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now(),
      sender: customName || userAddress,
      senderAddress: userAddress,
      content: newMessage,
      timestamp: new Date().toLocaleTimeString()
    };

    const updatedMessages = [...messages, message];
    setMessages(updatedMessages);
    setNewMessage('');
    
    // Save to localStorage
    localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
  };

  // Get display name for an address
  const getDisplayName = (address) => {
    const name = Object.keys(registeredNames).find(
      name => registeredNames[name] === address
    );
    return name ? `${name}.myens` : `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <MessageCircle className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Chat dApp</h1>
            <p className="text-gray-600">Connect your wallet to start chatting with custom ENS names</p>
          </div>
          
          <button
            onClick={connectWallet}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </button>
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
              <h1 className="text-xl font-bold text-gray-900">Chat dApp</h1>
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
                  />
                  <span className="flex items-center text-gray-500 text-sm">.myens</span>
                </div>
              </div>
              
              <button
                onClick={registerName}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Register Name
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

          {/* Registered Names List */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Registered Names</h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Object.keys(registeredNames).length === 0 ? (
                <p className="text-xs text-gray-500">No names registered yet</p>
              ) : (
                Object.keys(registeredNames).map((name) => (
                  <div key={name} className="text-xs text-gray-600 flex justify-between">
                    <span>{name}.myens</span>
                    <span>{registeredNames[name].slice(0, 6)}...</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm flex flex-col h-96">
          {/* Chat Header */}
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Global Chat</h2>
            <p className="text-sm text-gray-500">Chat with custom ENS names</p>
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
                        {getDisplayName(message.senderAddress)}
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
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={sendMessage}
                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleChatENS;