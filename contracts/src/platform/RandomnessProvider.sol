// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

interface IRandomGame {
    function fulfillRandomness(uint256 requestId, uint256 randomness) external;
}

contract RandomnessProvider is VRFConsumerBaseV2 {
    VRFCoordinatorV2Interface immutable COORDINATOR;
    
    uint64 immutable s_subscriptionId;
    bytes32 immutable i_keyHash;
    uint32 immutable i_callbackGasLimit;
    uint16 constant REQUEST_CONFIRMATIONS = 3;
    uint32 constant NUM_WORDS = 1;

    mapping(uint256 => address) public s_requestIdToAddress;
    event RequestSent(uint256 indexed requestId, address indexed requester);

    constructor(
        uint64 subscriptionId,
        address vrfCoordinator,
        bytes32 keyHash,
        uint32 callbackGasLimit
    ) VRFConsumerBaseV2(vrfCoordinator) {
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
        s_subscriptionId = subscriptionId;
        i_keyHash = keyHash;
        i_callbackGasLimit = callbackGasLimit;
    }

    function requestRandomWords() external returns (uint256 requestId) {
        requestId = COORDINATOR.requestRandomWords(
            i_keyHash,
            s_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        s_requestIdToAddress[requestId] = msg.sender;
        emit RequestSent(requestId, msg.sender);
        return requestId;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address gameAddress = s_requestIdToAddress[requestId];
        IRandomGame(gameAddress).fulfillRandomness(requestId, randomWords[0]);
    }
}