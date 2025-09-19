// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.13;
import "./interfaces/IENS.sol";

contract Chat {
    IENS ensContract;

    mapping(address => uint) public msgCount;
    mapping(string => mapping(address => bool)) public groupMembers;
    mapping(string => address) public groupOwners;

    struct Message {
        address from;
        address to;
        string message;
        string groupName; // empty string for direct messages
    }

    Message[] public messages;

    event MessageSent(address indexed from, address indexed to, string message);
    event GroupMessageSent(
        address indexed from,
        string indexed groupName,
        string message
    );

    constructor(address _ensAddress) {
        ensContract = IENS(_ensAddress);
    }

    // Direct message (existing functionality)
    function sendMessage(
        address _from,
        string calldata _msg,
        string calldata _to
    ) external {
        address _address = ensContract.getAddressFromName(_to);
        msgCount[_from] += 1;
        msgCount[_address] += 1;
        messages.push(Message(_from, _address, _msg, ""));
        emit MessageSent(_from, _address, _msg);
    }

    // Create group and send first message
    function createGroup(
        string calldata _groupName,
        string calldata _message
    ) external {
        require(groupOwners[_groupName] == address(0), "Group exists");
        groupOwners[_groupName] = msg.sender;
        groupMembers[_groupName][msg.sender] = true;

        msgCount[msg.sender] += 1;
        messages.push(Message(msg.sender, address(0), _message, _groupName));
        emit GroupMessageSent(msg.sender, _groupName, _message);
    }

    // Add member to group
    function addToGroup(
        string calldata _groupName,
        string calldata _memberName
    ) external {
        require(groupOwners[_groupName] == msg.sender, "Only owner");
        address member = ensContract.getAddressFromName(_memberName);
        groupMembers[_groupName][member] = true;
    }

    // Send group message
    function sendGroupMessage(
        string calldata _groupName,
        string calldata _message
    ) external {
        require(groupMembers[_groupName][msg.sender], "Not a member");

        msgCount[msg.sender] += 1;
        messages.push(Message(msg.sender, address(0), _message, _groupName));
        emit GroupMessageSent(msg.sender, _groupName, _message);
    }

    // Get group messages
    function getGroupMessages(
        string calldata _groupName
    ) external view returns (Message[] memory) {
        require(groupMembers[_groupName][msg.sender], "Not a member");

        uint count = 0;
        for (uint i = 0; i < messages.length; i++) {
            if (
                keccak256(bytes(messages[i].groupName)) ==
                keccak256(bytes(_groupName))
            ) {
                count++;
            }
        }

        Message[] memory groupMsgs = new Message[](count);
        count = 0;
        for (uint i = 0; i < messages.length; i++) {
            if (
                keccak256(bytes(messages[i].groupName)) ==
                keccak256(bytes(_groupName))
            ) {
                groupMsgs[count] = messages[i];
                count++;
            }
        }
        return groupMsgs;
    }

    // Existing functions (simplified)
    function getUserMessages() external view returns (Message[] memory) {
        uint count = 0;
        for (uint i = 0; i < messages.length; i++) {
            if (
                (messages[i].from == msg.sender ||
                    messages[i].to == msg.sender) &&
                bytes(messages[i].groupName).length == 0
            ) {
                count++;
            }
        }

        Message[] memory userMsgs = new Message[](count);
        count = 0;
        for (uint i = 0; i < messages.length; i++) {
            if (
                (messages[i].from == msg.sender ||
                    messages[i].to == msg.sender) &&
                bytes(messages[i].groupName).length == 0
            ) {
                userMsgs[count] = messages[i];
                count++;
            }
        }
        return userMsgs;
    }

    function getMessagesBetweenUsers(
        string calldata _name1,
        string calldata _name2
    ) external view returns (Message[] memory) {
        address user1 = ensContract.getAddressFromName(_name1);
        address user2 = ensContract.getAddressFromName(_name2);

        uint count = 0;
        for (uint i = 0; i < messages.length; i++) {
            if (
                bytes(messages[i].groupName).length == 0 &&
                ((messages[i].from == user1 && messages[i].to == user2) ||
                    (messages[i].from == user2 && messages[i].to == user1))
            ) {
                count++;
            }
        }

        Message[] memory userMsgs = new Message[](count);
        count = 0;
        for (uint i = 0; i < messages.length; i++) {
            if (
                bytes(messages[i].groupName).length == 0 &&
                ((messages[i].from == user1 && messages[i].to == user2) ||
                    (messages[i].from == user2 && messages[i].to == user1))
            ) {
                userMsgs[count] = messages[i];
                count++;
            }
        }
        return userMsgs;
    }

    function getCountOfMsg() external view returns (Message[] memory) {
        return messages;
    }
}
