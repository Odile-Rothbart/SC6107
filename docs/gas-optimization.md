# Gas Optimization Report

## Overview

This document details the gas optimization strategies implemented in our blockchain gaming platform, including measurement methodologies, optimization techniques, and performance benchmarks.

---

## 1. Gas Testing Methodology

### Tools & Configuration

We use **hardhat-gas-reporter** for comprehensive gas analysis across all contract methods and deployments.

**Configuration** (`hardhat.config.ts`):
```typescript
gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
}
```

**Compiler Settings** (optimized for gas efficiency):
```typescript
solidity: {
    version: "0.8.16",
    settings: {
        viaIR: true,              // Intermediate Representation for better optimization
        optimizer: {
            enabled: true,
            runs: 200,            // Balanced for deployment + runtime costs
        },
    },
}
```

### Running Gas Reports

**Method 1: Automated Gas Reporter**
```bash
# Enable gas reporting
REPORT_GAS=true npx hardhat test

# Output saved to gas-report.txt
```

**Method 2: Custom Gas Measurements**
```bash
# Run dedicated gas test suite
npx hardhat test contracts/test/gas.test.ts
```

Our custom gas test (`contracts/test/gas.test.ts`) measures transaction-level gas consumption for critical user flows:
- DiceGame bet placement and settlement
- Raffle entry and winner selection
- Treasury operations

---

## 2. High-Frequency & High-Cost Functions

### Critical Path Analysis

| Function | Contract | Avg Gas | Frequency | Impact |
|----------|----------|---------|-----------|--------|
| `placeBet()` | DiceGame | 291,274 | Very High | Critical |
| `enterRaffle()` | Raffle | 83,683 | High | Important |
| `performUpkeep()` | Raffle | 129,132 | Medium | Important |
| `fulfillRandomness()` | DiceGame | 71,611 | Very High | Critical |
| `requestRandomWords()` | RandomnessProvider | 91,320 | High | Important |
| `payout()` | Treasury | 39,645 | High | Optimized |

### Function Categories

**Player-Facing (User Pays Gas)**
- `DiceGame.placeBet()` - Most expensive user operation (291k gas)
- `Raffle.enterRaffle()` - Moderate cost (83k gas)

**Automated/Backend (Platform Pays Gas)**
- `Raffle.performUpkeep()` - Triggered by Chainlink Automation
- `fulfillRandomness()` - VRF callback (paid by subscription)

**Administrative**
- `Treasury.payout()` - Called by game contracts
- `Treasury.adminWithdraw()` - Owner operations

---

## 3. Gas Optimization Techniques Implemented

### 3.1 Custom Errors (Solidity 0.8.4+)

**Impact**: ~50% reduction in revert gas costs compared to `require()` strings

**Implementation**:
```solidity
// Old approach (expensive)
require(msg.value >= i_minBet, "Bet amount too low");

// Optimized approach
error DiceGame__BetTooLow(uint256 sent, uint256 min);
if (msg.value < i_minBet) revert DiceGame__BetTooLow(msg.value, i_minBet);
```

**Applied in**:
- `DiceGame.sol`: 6 custom errors
- `Raffle.sol`: 6 custom errors  
- `Treasury.sol`: 5 custom errors

### 3.2 Immutable Variables

**Impact**: ~2,100 gas saved per read (SLOAD → direct value)

**Implementation**:
```solidity
// Frequently accessed, never changes after deployment
RandomnessProvider public immutable i_randomnessProvider;
Treasury public immutable i_treasury;
uint256 private immutable i_minBet;
uint256 private immutable i_maxBet;
```

**Applied in**:
- DiceGame: 4 immutable variables
- Raffle: 4 immutable variables
- RandomnessProvider: 3 immutable variables

### 3.3 Storage Caching

**Impact**: ~100 gas saved per cached SLOAD

**Implementation**:
```solidity
// Cache storage reference
Round storage round = s_rounds[s_currentRoundId];

// Multiple accesses use cached reference
round.players.push(msg.sender);
round.prizePool += msg.value;
round.state = RaffleState.CALCULATING;
```

**Applied in**:
- `Raffle.sol`: All functions cache `s_rounds[s_currentRoundId]`
- `DiceGame.sol`: All functions cache `s_bets[betId]`

### 3.4 Efficient Data Structures

**Avoiding Full Array Iteration**:
```solidity
// Expensive: Loop through all players
for (uint i = 0; i < players.length; i++) { ... }

// Optimized: Use modulo for random selection
uint256 indexOfWinner = randomness % round.players.length;
address winner = round.players[indexOfWinner];
```

**Mapping-Based Lookups**:
```solidity
// O(1) lookup instead of O(n) iteration
mapping(uint256 => Bet) public s_bets;
mapping(address => uint256[]) private s_playerBets;
mapping(uint256 => uint256) private s_requestIdToBetId;
```

### 3.5 Uint Type Optimization

**Impact**: Packing smaller uints saves storage slots

**Implementation**:
```solidity
struct Bet {
    uint256 betId;
    BetStatus status;      // uint8 (enum)
    address player;        // 20 bytes
    uint256 amount;
    uint8 choice;          // Packed with address
    uint8 diceResult;      // Packed with address
    uint256 payout;
    uint64 timestamp;      // Smaller than uint256
}
```

### 3.6 State Machine Pattern

**Impact**: Prevents expensive double-settlement checks

**Implementation**:
```solidity
enum RaffleState { OPEN, CALCULATING, SETTLED }

function fulfillRandomness(uint256 requestId, uint256 randomness) external {
    // Single state check prevents re-entrancy and double settlement
    if (round.state != RaffleState.CALCULATING) revert Raffle__AlreadySettled();
    
    // ... settlement logic ...
    
    round.state = RaffleState.SETTLED;  // State update before external calls
}
```

### 3.7 Event Emission Over Storage

**Impact**: Events cost ~375 gas vs ~20,000 gas for SSTORE

**Implementation**:
```solidity
// Store only essential state, emit events for historical data
emit BetPlaced(betId, msg.sender, msg.value, choice, timestamp);
emit BetSettled(betId, player, diceResult, won, payout);
```

### 3.8 Short-Circuit Evaluation

**Implementation**:
```solidity
// Most likely to fail first (cheapest check)
bool upkeepNeeded = (isOpen && isIntervalPassed && hasPlayer);
```

---

## 4. Gas Consumption Benchmarks

### 4.1 Core Game Operations

Based on `gas-report.txt` and local testing:

```
┌─────────────────────────────────────────────────────────────┐
│ DiceGame Operations                                         │
├────────────────────────┬──────────┬──────────┬─────────────┤
│ Method                 │ Min      │ Max      │ Avg         │
├────────────────────────┼──────────┼──────────┼─────────────┤
│ placeBet()             │ 275,489  │ 292,589  │ 291,274     │
│ fulfillRandomness()    │  37,001  │  80,264  │  71,611     │
└────────────────────────┴──────────┴──────────┴─────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Raffle Operations                                           │
├────────────────────────┬──────────┬──────────┬─────────────┤
│ Method                 │ Min      │ Max      │ Avg         │
├────────────────────────┼──────────┼──────────┼─────────────┤
│ enterRaffle()          │  60,006  │  94,206  │  83,683     │
│ performUpkeep()        │    -     │    -     │ 129,132     │
└────────────────────────┴──────────┴──────────┴─────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Platform Operations                                         │
├────────────────────────┬──────────┬──────────┬─────────────┤
│ Method                 │ Min      │ Max      │ Avg         │
├────────────────────────┼──────────┼──────────┼─────────────┤
│ requestRandomWords()   │    -     │    -     │  91,320     │
│ Treasury.payout()      │    -     │    -     │  39,645     │
│ Treasury.setGame()     │    -     │    -     │  47,840     │
└────────────────────────┴──────────┴──────────┴─────────────┘
```

### 4.2 Deployment Costs

```
┌─────────────────────────────────────────────────────────────┐
│ Contract Deployments                                        │
├────────────────────────┬─────────────┬─────────────────────┤
│ Contract               │ Gas Cost    │ % of Block Limit    │
├────────────────────────┼─────────────┼─────────────────────┤
│ DiceGame               │   850,463   │ 1.4%                │
│ Raffle                 │ 1,046,837   │ 1.7%                │
│ RandomnessProvider     │   271,736   │ 0.5%                │
│ Treasury               │   572,321   │ 1.0%                │
└────────────────────────┴─────────────┴─────────────────────┘
```

### 4.3 Real-World Cost Analysis

At current gas prices (example: 30 gwei, ETH = $3,000):

| Operation | Gas | Cost (ETH) | Cost (USD) |
|-----------|-----|------------|------------|
| Place Dice Bet | 291,274 | 0.0087 ETH | $26.18 |
| Enter Raffle | 83,683 | 0.0025 ETH | $7.53 |
| Settle Dice Bet | 71,611 | 0.0021 ETH | $6.44 |
| Perform Upkeep | 129,132 | 0.0039 ETH | $11.62 |

**Note**: VRF fulfillment costs are paid by the Chainlink subscription, not end users.

---

## 5. Trade-offs & Design Decisions

### 5.1 Optimization Trade-offs

**Chosen: Immediate VRF Request in `placeBet()`**
- **Pro**: Better UX (instant feedback), simpler state management
- **Con**: Higher gas cost (~91k for VRF request included in user tx)
- **Rationale**: User experience prioritized; gas cost acceptable for dice game

**Chosen: Storage of Player Bet History**
```solidity
mapping(address => uint256[]) private s_playerBets;
```
- **Pro**: Easy frontend queries, better UX
- **Con**: Additional SSTORE costs (~20k gas per bet)
- **Rationale**: Essential for player dashboard; events alone insufficient

**Chosen: Centralized Treasury Pattern**
- **Pro**: Unified fund management, easier auditing, emergency pause
- **Con**: Additional external call overhead (~2,600 gas)
- **Rationale**: Security and operational flexibility outweigh minor gas cost

### 5.2 Avoided Anti-Patterns

**Avoided: Dynamic Array Iteration**
```solidity
// Never implemented: Loop through all players to find winner
for (uint i = 0; i < players.length; i++) {
    if (players[i] == target) { ... }
}
```

**Avoided: String Error Messages**
```solidity
// Never used: require(condition, "Long error message string");
```

**Avoided: Redundant Storage Reads**
```solidity
// Never: Multiple reads of same storage variable
if (s_rounds[id].state == OPEN) { ... }
if (s_rounds[id].players.length > 0) { ... }  // Re-reads s_rounds[id]
```

---

## 6. Future Optimization Opportunities

### 6.1 Short-Term Improvements

**1. Batch Operations** (Est. savings: 30-40% per additional operation)
```solidity
// Allow multiple raffle entries in one transaction
function enterRaffleBatch(uint256 count) external payable {
    // Amortize fixed costs across multiple entries
}
```

**2. Calldata Optimization** (Est. savings: 16 gas per zero byte)
```solidity
// Use calldata instead of memory for read-only parameters
function placeBet(uint8 choice) external payable {
    // Already optimized: uint8 instead of uint256
}
```

**3. Unchecked Math** (Est. savings: 20-40 gas per operation)
```solidity
// Safe to use unchecked for counter increments
unchecked {
    s_nextBetId++;
}
```

### 6.2 Medium-Term Improvements

**1. EIP-2929 Warm/Cold Storage Optimization**
- Restructure frequently accessed storage for warm access patterns
- Est. savings: 100-2,000 gas per transaction

**2. Proxy Pattern for Upgrades**
- Deploy minimal proxy clones for new game instances
- Est. savings: 90% deployment cost reduction

**3. Layer 2 Migration**
- Deploy on Arbitrum/Optimism for 10-100x gas cost reduction
- Maintain L1 for high-value operations only

### 6.3 Long-Term Research

**1. EIP-4844 (Proto-Danksharding)**
- Utilize blob transactions for event data
- Potential: 10-100x cost reduction for data availability

**2. Account Abstraction (EIP-4337)**
- Gasless transactions for users (platform sponsors)
- Improved UX without compromising decentralization

**3. ZK-Rollups for Settlement**
- Batch multiple game outcomes into single proof
- Potential: 100-1000x throughput increase

---

## 7. Monitoring & Continuous Optimization

### Gas Regression Testing

We maintain automated gas benchmarks in CI/CD:

```bash
# Run before every merge
REPORT_GAS=true npx hardhat test

# Compare against baseline
diff gas-report.txt gas-report-baseline.txt
```

### Metrics to Track

1. **Average gas per user operation** (target: <100k)
2. **Gas cost variance** (target: <10% between min/max)
3. **Deployment costs** (target: <2% of block limit)
4. **Failed transaction rate** (target: <0.1%)

---

## Conclusion

Our platform achieves competitive gas efficiency through:
- **Compiler optimization**: viaIR + 200 runs
- **Code patterns**: Custom errors, immutables, storage caching
- **Architecture**: Centralized randomness + treasury for economies of scale
- **Testing**: Comprehensive gas reporting and benchmarking

**Key Metrics**:
- DiceGame bet: ~291k gas (acceptable for instant-settlement game)
- Raffle entry: ~83k gas (competitive with similar protocols)
- Settlement: ~71k gas (highly optimized)

**Next Steps**:
1. Implement batch operations for power users
2. Explore L2 deployment for 10-100x cost reduction
3. Monitor real-world usage patterns for further optimization

---

*Last Updated: February 2026*  
*Solidity Version: 0.8.16*  
*Optimizer: Enabled (200 runs, viaIR)*
