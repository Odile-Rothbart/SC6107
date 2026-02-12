// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title VRFCoordinatorMock
 * @notice Mock contract for testing VRF v2.5 integration
 * @dev Simplified mock that simulates VRF Coordinator v2.5 behavior for local testing
 */
contract VRFCoordinatorMock {
    uint256 private s_requestCounter;
    
    // Store request details for testing
    struct Request {
        uint256 subId;
        address requester;
        uint32 numWords;
        bool fulfilled;
    }
    
    mapping(uint256 => Request) public s_requests;
    
    event RandomWordsRequested(
        bytes32 indexed keyHash,
        uint256 requestId,
        uint256 subId,
        uint16 requestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        bytes extraArgs,
        address indexed sender
    );
    
    event RandomWordsFulfilled(
        uint256 indexed requestId,
        uint256 outputSeed,
        uint256 subId,
        uint96 payment,
        bool nativePayment,
        bool success
    );

    /**
     * @notice Request random words (VRF v2.5 format)
     * @param req The request parameters
     * @return requestId The request ID
     */
    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata req
    ) external returns (uint256 requestId) {
        s_requestCounter++;
        requestId = s_requestCounter;
        
        s_requests[requestId] = Request({
            subId: req.subId,
            requester: msg.sender,
            numWords: req.numWords,
            fulfilled: false
        });
        
        emit RandomWordsRequested(
            req.keyHash,
            requestId,
            req.subId,
            req.requestConfirmations,
            req.callbackGasLimit,
            req.numWords,
            req.extraArgs,
            msg.sender
        );
        
        return requestId;
    }

    /**
     * @notice Fulfill random words request (for testing)
     * @param requestId The request ID to fulfill
     * @param consumer The consumer contract address
     * @dev In real VRF, this would be called by the oracle. In tests, we call it manually.
     */
    function fulfillRandomWords(
        uint256 requestId,
        address consumer
    ) external {
        Request storage request = s_requests[requestId];
        require(request.requester != address(0), "Request not found");
        require(!request.fulfilled, "Request already fulfilled");
        
        // Generate pseudo-random words for testing
        uint256[] memory randomWords = new uint256[](request.numWords);
        for (uint32 i = 0; i < request.numWords; i++) {
            randomWords[i] = uint256(keccak256(abi.encodePacked(requestId, i, block.timestamp)));
        }
        
        request.fulfilled = true;
        
        // Call the consumer's rawFulfillRandomWords function
        (bool success, ) = consumer.call(
            abi.encodeWithSignature(
                "rawFulfillRandomWords(uint256,uint256[])",
                requestId,
                randomWords
            )
        );
        
        emit RandomWordsFulfilled(
            requestId,
            randomWords[0],
            request.subId,
            0, // payment (not tracked in mock)
            true, // nativePayment
            success
        );
    }
    
    /**
     * @notice Fulfill with specific random words (for deterministic testing)
     * @param requestId The request ID to fulfill
     * @param consumer The consumer contract address
     * @param randomWords The specific random words to use
     */
    function fulfillRandomWordsWithOverride(
        uint256 requestId,
        address consumer,
        uint256[] memory randomWords
    ) external {
        Request storage request = s_requests[requestId];
        require(request.requester != address(0), "Request not found");
        require(!request.fulfilled, "Request already fulfilled");
        require(randomWords.length == request.numWords, "Wrong number of words");
        
        request.fulfilled = true;
        
        // Call the consumer's rawFulfillRandomWords function
        (bool success, ) = consumer.call(
            abi.encodeWithSignature(
                "rawFulfillRandomWords(uint256,uint256[])",
                requestId,
                randomWords
            )
        );
        
        emit RandomWordsFulfilled(
            requestId,
            randomWords[0],
            request.subId,
            0,
            true,
            success
        );
    }
    
    /**
     * @notice Get request details
     */
    function getRequest(uint256 requestId) external view returns (
        uint256 subId,
        address requester,
        uint32 numWords,
        bool fulfilled
    ) {
        Request memory request = s_requests[requestId];
        return (
            request.subId,
            request.requester,
            request.numWords,
            request.fulfilled
        );
    }
}
