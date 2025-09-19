// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.13;

contract ENS {
    error ZERO_ADDRESS_NOT_ALLOWED();
    error NAME_NOT_AVAILABLE();

    struct User {
        string name;
        string avatar;
        address _address;
    }

    event UserRegistered(address indexed _address, string indexed name);
    mapping(address => User) userInfo;
    mapping(string => address) names;

    User[] public users;

    function createAccount(
        address _from,
        string calldata _avatar,
        string calldata _name
    ) external {
        if (_from == address(0)) {
            revert ZERO_ADDRESS_NOT_ALLOWED();
        }
        if (names[_name] != address(0)) {
            revert NAME_NOT_AVAILABLE();
        }

        names[_name] = _from;

        User storage _newUser = userInfo[_from];
        _newUser.name = _name;
        _newUser.avatar = _avatar;
        _newUser._address = _from;

        users.push(_newUser);
        emit UserRegistered(_from, _name);
    }

    function getUserFromAddress(
        address _address
    ) external view returns (User memory) {
        return userInfo[_address];
    }

    function getUserFromName(
        string calldata _name
    ) external view returns (User memory) {
        return userInfo[names[_name]];
    }

    function getAddressFromName(
        string calldata _name
    ) external view returns (address) {
        return names[_name];
    }

    function userExists(string calldata _name) external view returns (bool) {
        return names[_name] != address(0);
    }

    function getAllUsers() external view returns (User[] memory) {
        return users;
    }
}
