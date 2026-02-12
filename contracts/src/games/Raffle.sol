// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import "../platform/RandomnessProvider.sol";
import "../platform/Treasury.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(
	uint256 currentBalance,
	uint256 numPlayers,
	uint256 raffleState
);
error Raffle__NotProvider();
error Raffle__AlreadySettled();
error Raffle__NoPlayers();

/**
 * @title  RaffleGame - Platform Integrated Lottery
 * @author Member C - Refactored for Platform Integration
 * @notice This contract is a platform-integrated raffle game using centralized RandomnessProvider and Treasury
 * @dev Key changes from original:
 *      - Removed VRFConsumerBaseV2 inheritance (now uses RandomnessProvider)
 *      - Added round-based system with state machine
 *      - Integrated with Treasury for secure payouts
 *      - Added double-settlement prevention via requestId mapping
 */
contract Raffle is AutomationCompatibleInterface {
	/* Types */
	enum RaffleState {
		OPEN,
		CALCULATING,
		SETTLED
	}

	struct Round {
		uint256 roundId;
		RaffleState state;
		uint64 startTime;
		address[] players;
		address winner;
		uint256 prizePool;
	}

	/* State variables */
	RandomnessProvider public immutable i_randomnessProvider;
	Treasury public immutable i_treasury;

	/* Lottery variables */
	uint256 private immutable i_entranceFee;
	uint256 private immutable i_interval;
	
	uint256 public s_currentRoundId;
	mapping(uint256 => Round) public s_rounds;
	mapping(uint256 => uint256) private s_requestIdToRoundId; // Prevents double-settlement

	/* Events */
	event RaffleEntered(uint256 indexed roundId, address indexed player, uint256 amount);
	event RandomnessRequested(uint256 indexed roundId, uint256 requestId);
	event WinnerPicked(uint256 indexed roundId, address indexed winner, uint256 amount);
	event RoundStarted(uint256 indexed roundId, uint64 startTime);

	/* Functions */
	constructor(
		address randomnessProvider,
		address treasury,
		uint256 entranceFee,
		uint256 interval
	) {
		require(randomnessProvider != address(0), "Invalid provider");
		require(treasury != address(0), "Invalid treasury");
		require(entranceFee > 0, "Invalid entrance fee");

		i_randomnessProvider = RandomnessProvider(randomnessProvider);
		i_treasury = Treasury(payable(treasury));
		i_entranceFee = entranceFee;
		i_interval = interval;

		// Initialize first round
		s_currentRoundId = 1;
		s_rounds[1].roundId = 1;
		s_rounds[1].state = RaffleState.OPEN;
		s_rounds[1].startTime = uint64(block.timestamp);

		emit RoundStarted(1, uint64(block.timestamp));
	}

	function enterRaffle() external payable {
		Round storage round = s_rounds[s_currentRoundId];

		if (round.state != RaffleState.OPEN) revert Raffle__NotOpen();
		if (msg.value < i_entranceFee) revert Raffle__NotEnoughETHEntered();

		round.players.push(msg.sender);
		round.prizePool += msg.value;

		emit RaffleEntered(s_currentRoundId, msg.sender, msg.value);
	}

	/**
	 * @dev This is the function that the Chainlink Keeper nodes call
	 * they look for `upkeepNeeded` to return true.
	 * the following should be true for this to return true:
	 * 1. The time interval has passed between raffle runs.
	 * 2. The lottery is open.
	 * 3. There is at least one player.
	 */
	function checkUpkeep(
		bytes memory /*checkData*/
	)
		public
		view
		override
		returns (
			bool, /* upkeepNeeded */
			bytes memory /*performData*/
		)
	{
		Round storage round = s_rounds[s_currentRoundId];

		bool isOpen = round.state == RaffleState.OPEN;
		bool isIntervalPassed = (block.timestamp - round.startTime) >
			i_interval;
		bool hasPlayer = (round.players.length > 0);
		
		// Only trigger upkeep if all conditions are met
		// If time passed but no players, round stays OPEN (can still accept entries)
		bool upkeepNeeded = (isOpen &&
			isIntervalPassed &&
			hasPlayer);

		return (upkeepNeeded, "0x0");
	}

	/**
	 * @dev Once `checkUpkeep` is returning `true`, this function is called
	 * and it kicks off a Chainlink VRF call via RandomnessProvider.
	 */
	function performUpkeep(
		bytes calldata /*performData*/
	) external override {
		(bool isUpkeepNeeded, ) = checkUpkeep("");

		Round storage round = s_rounds[s_currentRoundId];

		// If time passed but no players, reset the timer and keep round OPEN
		// This allows the round to continue accepting entries
		if (round.state == RaffleState.OPEN && 
		    (block.timestamp - round.startTime) > i_interval && 
		    round.players.length == 0) {
			// Reset timer to allow more time for players to join
			round.startTime = uint64(block.timestamp);
			return; // Exit early, round stays OPEN
		}

		if (!isUpkeepNeeded) {
			revert Raffle__UpkeepNotNeeded(
				round.prizePool,
				round.players.length,
				uint256(round.state)
			);
		}
		if (round.players.length == 0) revert Raffle__NoPlayers();

		round.state = RaffleState.CALCULATING;

		// Request randomness from platform provider
		uint256 requestId = i_randomnessProvider.requestRandomWords();
		s_requestIdToRoundId[requestId] = s_currentRoundId;

		emit RandomnessRequested(s_currentRoundId, requestId);
	}

	/**
	 * @dev This is the callback function that RandomnessProvider calls
	 * to provide the random number. Only RandomnessProvider can call this.
	 * 
	 * Security improvements:
	 * - Only RandomnessProvider can call (prevents manipulation)
	 * - State machine prevents double-settlement
	 * - Funds routed through Treasury (audit trail + centralized security)
	 */
	function fulfillRandomness(uint256 requestId, uint256 randomness) external {
		if (msg.sender != address(i_randomnessProvider)) revert Raffle__NotProvider();

		uint256 roundId = s_requestIdToRoundId[requestId];
		Round storage round = s_rounds[roundId];

		// Prevent double settlement
		if (round.state != RaffleState.CALCULATING) revert Raffle__AlreadySettled();

		/* Calculate a winner */
		uint256 indexOfWinner = randomness % round.players.length;
		address currentWinner = round.players[indexOfWinner];
		round.winner = currentWinner;
		round.state = RaffleState.SETTLED;

		uint256 winnersPrize = round.prizePool;

		// Transfer funds to Treasury first
		(bool sent, ) = payable(address(i_treasury)).call{value: winnersPrize}("");
		require(sent, "Failed to send to treasury");

		// Then payout through Treasury (centralized payout management)
		i_treasury.payout(payable(currentWinner), winnersPrize);

		emit WinnerPicked(roundId, currentWinner, winnersPrize);

		/* Start new round */
		s_currentRoundId++;
		Round storage newRound = s_rounds[s_currentRoundId];
		newRound.roundId = s_currentRoundId;
		newRound.state = RaffleState.OPEN;
		newRound.startTime = uint64(block.timestamp);

		emit RoundStarted(s_currentRoundId, uint64(block.timestamp));
	}

	/* Getter functions */
	function getEntrancyFee() external view returns (uint256) {
		return i_entranceFee;
	}

	function getPlayer(uint256 roundId, uint256 index) external view returns (address) {
		return s_rounds[roundId].players[index];
	}

	function getRecentWinner() external view returns (address) {
		if (s_currentRoundId > 1) {
			return s_rounds[s_currentRoundId - 1].winner;
		}
		return address(0);
	}

	function getRaffleState() external view returns (RaffleState) {
		return s_rounds[s_currentRoundId].state;
	}

	function getLastRaffleTime() external view returns (uint64) {
		return s_rounds[s_currentRoundId].startTime;
	}

	function getNumberOfPlayers() external view returns (uint256) {
		return s_rounds[s_currentRoundId].players.length;
	}

	function getInterval() external view returns (uint256) {
		return i_interval;
	}

	/**
	 * @notice Get current round information
	 * @return roundId Current round ID
	 * @return state Current round state
	 * @return startTime When the round started
	 * @return playerCount Number of players in current round
	 * @return prizePool Total ETH in prize pool
	 * @return winner Winner address (0x0 if not settled)
	 */
	function getCurrentRound() external view returns (
		uint256 roundId,
		RaffleState state,
		uint64 startTime,
		uint256 playerCount,
		uint256 prizePool,
		address winner
	) {
		Round storage round = s_rounds[s_currentRoundId];
		return (
			round.roundId,
			round.state,
			round.startTime,
			round.players.length,
			round.prizePool,
			round.winner
		);
	}

	function getRound(uint256 roundId) external view returns (Round memory) {
		return s_rounds[roundId];
	}

	function getTimeUntilDraw() external view returns (uint256) {
		Round storage round = s_rounds[s_currentRoundId];
		uint256 elapsed = block.timestamp - round.startTime;
		if (elapsed >= i_interval) return 0;
		return i_interval - elapsed;
	}
}
