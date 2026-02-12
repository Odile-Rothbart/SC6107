// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

interface IRandomGame {
    function fulfillRandomness(uint256 requestId, uint256 randomness) external;
}

contract RandomnessProvider is VRFConsumerBaseV2Plus {
    uint256 immutable s_subscriptionId;
    bytes32 immutable i_keyHash;
    uint32 immutable i_callbackGasLimit;
    uint16 constant REQUEST_CONFIRMATIONS = 3;
    uint32 constant NUM_WORDS = 1;

    mapping(uint256 => address) public s_requestIdToAddress;
    event RequestSent(uint256 indexed requestId, address indexed requester);

    constructor(
        uint256 subscriptionId,
        address vrfCoordinator,
        bytes32 keyHash,
        uint32 callbackGasLimit
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        s_subscriptionId = subscriptionId;
        i_keyHash = keyHash;
        i_callbackGasLimit = callbackGasLimit;
    }

    function requestRandomWords() external returns (uint256 requestId) {
        // VRF V2.5 使用新的请求格式
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: i_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: i_callbackGasLimit,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: true}) // 使用 ETH 支付
                )
            })
        );
        s_requestIdToAddress[requestId] = msg.sender;
        emit RequestSent(requestId, msg.sender);
        return requestId;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        address gameAddress = s_requestIdToAddress[requestId];
        IRandomGame(gameAddress).fulfillRandomness(requestId, randomWords[0]);
    }
}
