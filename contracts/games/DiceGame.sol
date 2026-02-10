// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import "../platform/RandomnessProvider.sol";
import "../platform/Treasury.sol";

error DiceGame__BetTooLow(uint256 sent, uint256 min);
error DiceGame__BetTooHigh(uint256 sent, uint256 max);
error DiceGame__NotProvider();
error DiceGame__AlreadySettled();
error DiceGame__InvalidChoice(uint8 choice);
error DiceGame__BetNotFound();

/**
 * @title  DiceGame - Platform Integrated Dice Betting Game
 * @author SC6107 Team
 * @notice This contract is a platform-integrated dice game using centralized RandomnessProvider and Treasury
 * @dev Key features:
 *      - Players bet on dice outcome (1-6)
 *      - Uses RandomnessProvider for provably fair randomness
 *      - Integrated with Treasury for secure payouts
 *      - State machine prevents double-settlement
 *      - House edge: 2% (98% payout on wins)
 * 
 * @dev IMPORTANT: Treasury Configuration Requirement
 *      Treasury.maxPayoutPerTx MUST be >= maxBet * MULTIPLIER * (1 - HOUSE_EDGE)
 *      Example: If maxBet = 1 ETH, then maxPayoutPerTx >= 1 * 6 * 0.98 = 5.88 ETH
 *      Otherwise, payout will revert with Treasury.ExceedsMaxPayout error.
 */
contract DiceGame {
	/* Types */
	enum BetStatus {
		OPEN,
		CALCULATING,
		SETTLED
	}

	struct Bet {
		uint256 betId;
		BetStatus status;
		address player;
		uint256 amount;
		uint8 choice;        // Player's chosen number (1-6)
		uint8 diceResult;    // Actual dice result (1-6), 0 if not yet rolled
		uint256 payout;      // Amount paid out (0 if lost)
		uint64 timestamp;
	}

	/* State variables */
	RandomnessProvider public immutable i_randomnessProvider;
	Treasury public immutable i_treasury;

	/* Game configuration */
	uint256 private immutable i_minBet;
	uint256 private immutable i_maxBet;
	
	// Payout calculation constants
	uint256 private constant MULTIPLIER = 6;           // 6x for correct guess
	uint256 private constant HOUSE_EDGE_BPS = 200;     // 2% house edge (200 basis points)
	uint256 private constant BPS_BASE = 10000;         // Basis points denominator
	
	uint256 public s_nextBetId;
	mapping(uint256 => Bet) public s_bets;
	mapping(uint256 => uint256) private s_requestIdToBetId; // Prevents double-settlement
	mapping(address => uint256[]) private s_playerBets;     // Track player's bet history

	/* Events */
	event BetPlaced(uint256 indexed betId, address indexed player, uint256 amount, uint8 choice, uint64 timestamp);
	event RandomnessRequested(uint256 indexed betId, uint256 requestId);
	event BetSettled(uint256 indexed betId, address indexed player, uint8 diceResult, bool won, uint256 payout);

	/* Functions */
	constructor(
		address randomnessProvider,
		address treasury,
		uint256 minBet,
		uint256 maxBet
	) {
		require(randomnessProvider != address(0), "Invalid provider");
		require(treasury != address(0), "Invalid treasury");
		require(minBet > 0, "Invalid min bet");
		require(maxBet > minBet, "Max bet must be greater than min bet");

		i_randomnessProvider = RandomnessProvider(randomnessProvider);
		i_treasury = Treasury(payable(treasury));
		i_minBet = minBet;
		i_maxBet = maxBet;

		// Initialize bet counter (starts at 1)
		s_nextBetId = 1;
	}

	/**
	 * @notice Place a bet on a dice number (1-6)
	 * @param choice The number to bet on (must be 1-6)
	 * @dev Immediately requests randomness after bet is placed.
	 *      Bet amount is transferred to Treasury immediately (enters prize pool).
	 */
	function placeBet(uint8 choice) external payable {
		// Validate choice
		if (choice < 1 || choice > 6) revert DiceGame__InvalidChoice(choice);
		
		// Validate bet amount
		if (msg.value < i_minBet) revert DiceGame__BetTooLow(msg.value, i_minBet);
		if (msg.value > i_maxBet) revert DiceGame__BetTooHigh(msg.value, i_maxBet);

		// Create bet
		uint256 betId = s_nextBetId++;
		Bet storage bet = s_bets[betId];
		bet.betId = betId;
		bet.status = BetStatus.OPEN;
		bet.player = msg.sender;
		bet.amount = msg.value;
		bet.choice = choice;
		bet.timestamp = uint64(block.timestamp);

		// Track player's bet
		s_playerBets[msg.sender].push(betId);

		emit BetPlaced(betId, msg.sender, msg.value, choice, bet.timestamp);

		// Transfer bet amount to Treasury immediately (enters prize pool)
		i_treasury.deposit{value: msg.value}();

		// Immediately request randomness (similar to Raffle's performUpkeep)
		bet.status = BetStatus.CALCULATING;

		// Request randomness from platform provider
		uint256 requestId = i_randomnessProvider.requestRandomWords();
		s_requestIdToBetId[requestId] = betId;

		emit RandomnessRequested(betId, requestId);
	}

	/**
	 * @dev This is the callback function that RandomnessProvider calls
	 * to provide the random number. Only RandomnessProvider can call this.
	 * 
	 * Security features (matching Raffle pattern):
	 * - Only RandomnessProvider can call (prevents manipulation)
	 * - State machine prevents double-settlement
	 * - Funds routed through Treasury (bet amount already transferred in placeBet)
	 * 
	 * Flow:
	 * - If player wins: Treasury pays out calculated winnings
	 * - If player loses: Bet amount stays in Treasury (already transferred in placeBet)
	 */
	function fulfillRandomness(uint256 requestId, uint256 randomness) external {
		if (msg.sender != address(i_randomnessProvider)) revert DiceGame__NotProvider();

		uint256 betId = s_requestIdToBetId[requestId];
		if (betId == 0) revert DiceGame__BetNotFound();
		
		Bet storage bet = s_bets[betId];

		// Prevent double settlement
		if (bet.status != BetStatus.CALCULATING) revert DiceGame__AlreadySettled();

		/* Calculate dice result (1-6) */
		uint8 diceResult = uint8((randomness % 6) + 1);
		bet.diceResult = diceResult;

		/* Determine win/loss */
		bool won = (diceResult == bet.choice);
		uint256 payoutAmount = 0;

		if (won) {
			// Calculate payout: betAmount * 6 * 0.98 (2% house edge)
			uint256 grossPayout = bet.amount * MULTIPLIER;
			payoutAmount = (grossPayout * (BPS_BASE - HOUSE_EDGE_BPS)) / BPS_BASE;
			bet.payout = payoutAmount;
		} else {
			// Player lost - bet amount stays in Treasury (already transferred in placeBet)
			bet.payout = 0;
		}

		// Update state to SETTLED (matching Raffle pattern: state update before external call)
		bet.status = BetStatus.SETTLED;

		// Clean up requestId mapping
		delete s_requestIdToBetId[requestId];

		// If won, payout through Treasury (external call after state update)
		if (won) {
			i_treasury.payout(payable(bet.player), payoutAmount);
		}

		emit BetSettled(betId, bet.player, diceResult, won, payoutAmount);
	}

	/* Getter functions */
	
	/**
	 * @notice Get bet details by ID
	 */
	function getBet(uint256 betId) external view returns (Bet memory) {
		return s_bets[betId];
	}

	/**
	 * @notice Get all bet IDs for a player
	 */
	function getPlayerBets(address player) external view returns (uint256[] memory) {
		return s_playerBets[player];
	}

	/**
	 * @notice Get player's bet count
	 */
	function getPlayerBetCount(address player) external view returns (uint256) {
		return s_playerBets[player].length;
	}

	/**
	 * @notice Get player's most recent bet
	 */
	function getPlayerRecentBet(address player) external view returns (Bet memory) {
		uint256[] memory playerBets = s_playerBets[player];
		if (playerBets.length == 0) {
			return Bet(0, BetStatus.OPEN, address(0), 0, 0, 0, 0, 0);
		}
		uint256 lastBetId = playerBets[playerBets.length - 1];
		return s_bets[lastBetId];
	}

	/**
	 * @notice Get minimum bet amount
	 */
	function getMinBet() external view returns (uint256) {
		return i_minBet;
	}

	/**
	 * @notice Get maximum bet amount
	 */
	function getMaxBet() external view returns (uint256) {
		return i_maxBet;
	}

	/**
	 * @notice Get game configuration
	 * @return minBet Minimum bet amount
	 * @return maxBet Maximum bet amount
	 * @return multiplier Win multiplier (6x)
	 * @return houseEdgeBps House edge in basis points (200 = 2%)
	 */
	function getGameConfig() external view returns (
		uint256 minBet,
		uint256 maxBet,
		uint256 multiplier,
		uint256 houseEdgeBps
	) {
		return (i_minBet, i_maxBet, MULTIPLIER, HOUSE_EDGE_BPS);
	}

	/**
	 * @notice Calculate expected payout for a bet amount
	 * @param betAmount The bet amount to calculate payout for
	 * @return Expected payout if player wins (includes 2% house edge)
	 */
	function calculatePayout(uint256 betAmount) external pure returns (uint256) {
		uint256 grossPayout = betAmount * MULTIPLIER;
		return (grossPayout * (BPS_BASE - HOUSE_EDGE_BPS)) / BPS_BASE;
	}

	/**
	 * @notice Get current bet counter
	 */
	function getNextBetId() external view returns (uint256) {
		return s_nextBetId;
	}

	/**
	 * @notice Get contract balance (for monitoring)
	 */
	function getContractBalance() external view returns (uint256) {
		return address(this).balance;
	}
}
