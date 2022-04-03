//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IERC20.sol";

contract Treasury {
    address public cUsdTokenAddress;

    constructor(address tokenAddress) {
        cUsdTokenAddress = tokenAddress;
    }

    int256 public treasuryAmount;
    int256 public maxAmount;

    struct Transaction {
        int256 amount;
        address from;
        int256 previousBalance;
        uint256 date;
        string message;
    }
    mapping(uint256 => Transaction) internal transactions;
    uint256 internal transactionsLength;

    mapping(address => int256) internal balances;

    function add(int256 amount, string calldata message) public {
        require(amount > 0, "Amount too low.");
        require(
            IERC20(cUsdTokenAddress).transferFrom(
                msg.sender,
                address(this),
                uint256(amount)
            ),
            "Transfer failed."
        );

        treasuryAmount += amount;
        if (balances[msg.sender] >= 0) {
            maxAmount += amount;
        } else if (balances[msg.sender] + amount > 0) {
            maxAmount += balances[msg.sender] + amount;
        }

        Transaction memory transaction;
        transaction.amount = amount;
        transaction.from = msg.sender;
        transaction.previousBalance = balances[msg.sender];
        transaction.date = block.timestamp;
        transaction.message = message;
        
        transactions[transactionsLength] = transaction;
        transactionsLength += 1;

        balances[msg.sender] += amount;
    }

    function remove(int256 amount, string calldata message) public {
        require(amount > 0, "Amount too low.");
        require(
            IERC20(cUsdTokenAddress).transfer(msg.sender, uint256(amount)),
            "Transfer failed."
        );

        treasuryAmount -= amount;
        if (balances[msg.sender] > 0) {
            if (balances[msg.sender] - amount < 0) {
                maxAmount -= balances[msg.sender];
            } else {
                maxAmount -= amount;
            }
        }

        Transaction memory transaction;
        transaction.amount = -amount;
        transaction.from = msg.sender;
        transaction.previousBalance = balances[msg.sender];
        transaction.date = block.timestamp;
        transaction.message = message;
        
        transactions[transactionsLength] = transaction;
        transactionsLength += 1;

        balances[msg.sender] -= amount;
    }

    function getTransactions() public view returns (Transaction[] memory) {
        Transaction[] memory _transactions = new Transaction[](
            transactionsLength
        );
        for (uint256 i = 0; i < transactionsLength; i++) {
            _transactions[i] = transactions[i];
        }
        return _transactions;
    }

    function getBalance(address account) public view returns (int256) {
        return balances[account];
    }
}
