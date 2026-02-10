// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title Treasury
 * @notice Platform treasury that holds ETH and allows authorized games to payout winners.
 *         - onlyOwner: manage games, pause, set limits, withdraw.
 *         - onlyGame: payout to winners.
 */
contract Treasury is Ownable, Pausable {
    mapping(address => bool) public isGame;

    // Max payout allowed per single transaction
    uint256 public maxPayoutPerTx;

    event Deposited(address indexed from, uint256 amount);
    event GameAuthorized(address indexed game, bool allowed);
    event MaxPayoutPerTxUpdated(uint256 maxPayoutPerTx);
    event PaidOut(address indexed game, address indexed to, uint256 amount);
    event AdminWithdrawn(address indexed to, uint256 amount);

    error NotGame();
    error ZeroAddress();
    error AmountZero();
    error ExceedsMaxPayout(uint256 amount, uint256 maxAllowed);
    error InsufficientTreasuryBalance(uint256 required, uint256 available);

    constructor(uint256 _maxPayoutPerTx) {
        maxPayoutPerTx = _maxPayoutPerTx;
        emit MaxPayoutPerTxUpdated(_maxPayoutPerTx);
    }

    // Allow receiving ETH directly
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function deposit() external payable {
        if (msg.value == 0) revert AmountZero();
        emit Deposited(msg.sender, msg.value);
    }

    modifier onlyGame() {
        if (!isGame[msg.sender]) revert NotGame();
        _;
    }

    function setGame(address game, bool allowed) external onlyOwner {
        if (game == address(0)) revert ZeroAddress();
        isGame[game] = allowed;
        emit GameAuthorized(game, allowed);
    }

    function setMaxPayoutPerTx(uint256 _maxPayoutPerTx) external onlyOwner {
        maxPayoutPerTx = _maxPayoutPerTx;
        emit MaxPayoutPerTxUpdated(_maxPayoutPerTx);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Payout winner. Callable only by authorized game contracts.
     */
    function payout(address payable to, uint256 amount) external onlyGame whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountZero();
        if (maxPayoutPerTx != 0 && amount > maxPayoutPerTx) {
            revert ExceedsMaxPayout(amount, maxPayoutPerTx);
        }

        uint256 bal = address(this).balance;
        if (bal < amount) revert InsufficientTreasuryBalance(amount, bal);

        (bool ok, ) = to.call{value: amount}("");
        require(ok, "TREASURY_PAYOUT_FAILED");
        emit PaidOut(msg.sender, to, amount);
    }

    /**
     * @notice Owner withdraw (e.g., funding management on testnet).
     */
    function adminWithdraw(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountZero();

        uint256 bal = address(this).balance;
        if (bal < amount) revert InsufficientTreasuryBalance(amount, bal);

        (bool ok, ) = to.call{value: amount}("");
        require(ok, "TREASURY_WITHDRAW_FAILED");
        emit AdminWithdrawn(to, amount);
    }

    function treasuryBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
