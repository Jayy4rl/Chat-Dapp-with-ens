// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IENS {
    struct User {
        string name;
        string avatar;
        address address_;
    }

    event UserRegistered(address indexed _address, string indexed name);

    function createAccount(
        address _from,
        string calldata _avatar,
        string calldata _name
    ) external;

    function getUserFromAddress(
        address _address
    ) external view returns (User memory);

    function getUserFromName(
        string calldata _name
    ) external view returns (User memory);

    function getAddressFromName(
        string calldata _name
    ) external view returns (address);

    function userExists(string calldata _name) external view returns (bool);

    function getAllUsers() external view returns (User[] memory);
}
