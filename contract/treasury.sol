//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// import "./IERC20.sol";

// importing the interface in the contract itself. could not find in the Github repo.
interface IERC20Token {
    function transfer(address, uint256) external returns (bool);

    function approve(address, uint256) external returns (bool);

    function transferFrom(
        address,
        address,
        uint256
    ) external returns (bool);

    function totalSupply() external view returns (uint256);

    function balanceOf(address) external view returns (uint256);

    function allowance(address, address) external view returns (uint256);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

contract Treasury {
    // changing the address to internal as it should not be accessed from outside
    address internal cUsdTokenAddress =
        0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;

    // changing the int256 datatype for all the currency amounts to uint256 as it cannot be negative
    uint256 public treasuryAmount;
    uint256 public maxAmount;

    // added events triggered when amount is added or removed
    event amountAdded(address indexed sender, uint256 amount);
    event amountRemoved(address indexed borrower, uint256 amount);

    struct Transaction {
        // changing the amount datatype to uint256, as the amount should not be negative
        uint256 amount;
        address from;
        uint256 previousBalance;
        uint256 date;
        string message;
    }
    mapping(uint256 => Transaction) internal transactions;
    uint256 internal transactionsLength;
    mapping(address => uint256) internal balances;

    function add(uint256 amount, string calldata message) public payable {
        require(amount > 0, "Amount too low.");
        require(
            IERC20Token(cUsdTokenAddress).transferFrom(
                msg.sender,
                address(this),
                uint256(amount)
            ),
            "Transfer failed."
        );

        treasuryAmount += amount;
        maxAmount = balances[msg.sender] + amount;

        Transaction memory transaction;
        transaction.amount = amount;
        transaction.from = msg.sender;
        transaction.previousBalance = balances[msg.sender];
        transaction.date = block.timestamp;
        transaction.message = message;

        transactions[transactionsLength] = transaction;
        transactionsLength += 1;

        balances[msg.sender] += amount;
        // emiting the amountAdded event.
        emit amountAdded(msg.sender, amount);
    }

    function remove(uint256 amount, string calldata message) public payable {
        require(amount > 0, "Amount too low.");
        // I am keeping it such that the user can only borrow 2x times his/her celo wallet's current balance,
        // so that the user does not borrow all the money form the pool. This will reduce the amount that might be stolen.
        require(
            (balances[msg.sender] + amount) <=
                ((IERC20Token(cUsdTokenAddress).balanceOf(msg.sender) * 2) /
                    (10**18)),
            "You have crossed the limit of borrowing!"
        );
        require(
            IERC20Token(cUsdTokenAddress).transfer(msg.sender, uint256(amount)),
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
        transaction.amount -= amount;
        transaction.from = msg.sender;
        transaction.previousBalance = balances[msg.sender];
        transaction.date = block.timestamp;
        transaction.message = message;

        transactions[transactionsLength] = transaction;
        transactionsLength += 1;

        balances[msg.sender] -= amount;
        // emiting amountRemoved
        emit amountRemoved(msg.sender, amount);
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

    function getBalance(address account) public view returns (uint256) {
        return balances[account];
    }
}
