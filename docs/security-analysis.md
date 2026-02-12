# Security Analysis

**Project Name**:Trustless Gaming: An On-Chain Verifiable Randomness Platform
**Type**: Option 4 (Verifiable Randomness Game)

---

## 1. Security Goals & Scope

### 1.1 Security Goals

This document evaluates the security posture of the platform's smart contract layer, focusing on the following objectives:

- Ensure verifiable randomness integrity through Chainlink VRF integration
- Protect user funds and treasury assets from unauthorized access
- Enforce strict state machine transitions to prevent double-settlement
- Prevent common smart contract vulnerabilities (reentrancy, integer overflow, access control violations)
- Validate security properties through comprehensive testing

### 1.2 Scope

**Included:**
- All contracts under `contracts/src/`
  - `games/DiceGame.sol`
  - `games/Raffle.sol`
  - `platform/RandomnessProvider.sol`
  - `platform/Treasury.sol`
- VRF request and callback logic
- Treasury payout mechanism
- Game lifecycle state management

**Excluded:**
- Frontend implementation (`frontend/`)
- Deployment scripts (`scripts/`)
- External dependencies (Chainlink VRF Coordinator)

---

## 2. Threat Model

This analysis considers the following adversarial capabilities and attack vectors:

- **Malicious external actors:** Attempting unauthorized fund access or contract manipulation
- **Malicious contract interactions:** External contracts calling protocol functions
- **Replay attacks:** Reusing VRF callbacks or transaction data
- **Reentrancy attacks:** Exploiting external calls to reenter contract state
- **Unauthorized treasury access:** Bypassing access control to withdraw funds
- **Denial-of-Service (DoS):** Gas griefing or unbounded loops causing transaction failures
- **Front-running / MEV:** Transaction ordering manipulation for economic advantage

---

## 3. Randomness Security

### 3.1 VRF Integration Architecture

The platform abstracts randomness generation through `RandomnessProvider.sol`, which interfaces with Chainlink VRF v2 (on Sepolia) or `VRFCoordinatorMock` (for local testing).

**Security Property:** Only the official Chainlink VRF Coordinator can invoke `fulfillRandomWords()` in the `RandomnessProvider` contract. This is enforced by the `VRFConsumerBaseV2` base contract, preventing unauthorized randomness injection.

### 3.2 Request Tracking & Replay Protection

Each randomness request generates a unique `requestId` that is:
- Mapped to a specific game contract and bet/round identifier
- Consumed exactly once during fulfillment
- Deleted from the mapping after successful settlement

**Mitigation:** The requestId is invalidated after successful settlement, preventing repeated fulfillment.

### 3.3 Block-Based Randomness Exclusion

The platform does not use the following sources for randomness generation:
- `block.timestamp`
- `blockhash()`
- `block.number`

**Rationale:** These values are either predictable or subject to miner manipulation. All randomness is derived exclusively from Chainlink VRF.

---

## 4. Smart Contract Security Measures

### 4.1 Reentrancy Protection

All fund transfers are routed through `Treasury.sol`, which implements the Checks-Effects-Interactions (CEI) pattern:

1. **Checks:** Validate caller authorization and amount limits
2. **Effects:** Update contract state before external calls
3. **Interactions:** Transfer funds to recipients

**Implementation:**
- State variables are updated before calling `Treasury.payout()`
- Game contracts mark bets/rounds as `SETTLED` before requesting payouts
- No user-controlled external calls occur before state updates

### 4.2 Access Control

**Treasury.sol:**
- `payout()`: Restricted to authorized game contracts via `s_authorizedGames` mapping
- `adminWithdraw()`: Restricted to contract owner via `onlyOwner` modifier
- `setGame()`: Restricted to owner for authorizing new games

**RandomnessProvider.sol:**
- `requestRandomWords()`: Callable by any address (games validate requests internally)
- `fulfillRandomWords()`: Restricted to VRF Coordinator via `VRFConsumerBaseV2` inheritance

**Game Contracts:**
- State-changing functions validate bet amounts, state transitions, and time constraints
- No privileged roles in game contracts beyond state validation logic

### 4.3 Integer Safety

- Solidity 0.8.16 provides automatic overflow/underflow protection for all arithmetic operations
- No `unchecked` blocks are used for balance calculations
- Payout amounts are computed using safe multiplication and division

### 4.4 Double Settlement Protection

**DiceGame:**
- Each bet transitions through states: `OPEN → CALCULATING → SETTLED`
- Once marked `SETTLED`, the bet cannot be re-entered
- The `requestId` mapping is deleted after fulfillment, preventing replay

**Raffle:**
- Rounds transition through states: `OPEN → CALCULATING → OPEN`
- The `CALCULATING` state prevents new entries and additional draw requests
- `s_players` array is reset after winner selection
- Winner is recorded in `s_recentWinner` before payout

---

## 5. Economic & MEV Considerations

### 5.1 Front-Running Resistance

**DiceGame:**
- Bet parameters (amount, choice) are locked at transaction submission
- Outcome is determined exclusively by the VRF result after the bet is recorded
- Outcome determination does not depend on block metadata or intra-block ordering.

**Raffle:**
- Entry is closed when state transitions to `CALCULATING`
- No new entries can be added after the draw request is initiated
- Winner selection is based on the `s_players` array snapshot at draw time

### 5.2 Solvency & Payout Constraints

**Treasury Solvency:**
- `Treasury.payout()` checks that the requested amount does not exceed `maxPayoutPerTx`
- `Treasury.payout()` validates sufficient contract balance before transfer
- Games do not implement independent payout logic; all transfers route through Treasury

**DiceGame Payout Limits:**
- Maximum payout is bounded by `maxBet × MULTIPLIER × (1 - HOUSE_EDGE)`
- Configuration ensures `maxPayoutPerTx` is set appropriately for worst-case scenarios

**Raffle Payout:**
- Winner receives the contract balance at the time of fulfillment
- No unbounded loops or batch transfers

---

## 6. Denial-of-Service Mitigation

### 6.1 Bounded Computation

**No Unbounded Loops:**
- DiceGame settles individual bets independently
- Raffle selects a single winner per round using modulo arithmetic
- No iteration over dynamic arrays during settlement

**Rationale:** Prevents gas-limit-based DoS where transaction costs exceed block gas limits.

### 6.2 Controlled External Calls

External calls are limited to:
- `Treasury.payout(address, uint256)` for fund transfers
- `VRFCoordinatorV2Interface.requestRandomWords()` for randomness requests

**Security Properties:**
- No `delegatecall` usage
- No arbitrary low-level `.call()` with user-supplied data
- All external calls target trusted contracts (Treasury, VRF Coordinator)

---

## 7. Security Invariants

The system enforces the following security-critical invariants:

1. **Single Settlement:** A DiceGame bet transitions to `SETTLED` exactly once.
2. **Unique Winner:** A Raffle round produces exactly one winner per draw.
3. **One-Time Consumption:** A VRF `requestId` cannot be fulfilled more than once.
4. **Treasury Authorization:** Only authorized game contracts can call `Treasury.payout()`.
5. **Solvency Enforcement:** Treasury maintains sufficient balance for all payouts.
6. **State Machine Integrity:** Raffle cannot re-enter `CALCULATING` state without completing a draw and resetting to `OPEN`.
7. **VRF Source Validation:** Only the VRF Coordinator can invoke fulfillment callbacks.

---

## 8. Static Analysis

### 8.1 Tooling

Static analysis was performed using:
- **Slither** (v0.10+)

**Command:**
```bash
slither contracts/src/
```

### 8.2 Findings Summary

- **Critical vulnerabilities:** None detected
- **Reentrancy risks:** None detected
- **Unsafe delegatecall:** None detected
- **Access control issues:** None detected
- **Minor findings:** Gas optimization suggestions only (e.g., state variable caching)

All findings were reviewed and addressed where applicable.

---

## 9. Security Validation via Testing

Security properties are validated through the project test suite (see `docs/test-coverage.md`).

### 9.1 Coverage Metrics

| Metric       | Coverage | Threshold |
|:-------------|:--------:|:---------:|
| Lines        | 93.64%   | ≥80%      |
| Statements   | 91.13%   | ≥80%      |
| Functions    | 87.80%   | ≥80%      |
| Branches     | 71.74%   | N/A       |

All metrics meet or exceed the required ≥80% threshold.

### 9.2 Invariant Testing

Dedicated invariant tests (`contracts/test/invariants.test.ts`) validate system-wide security properties:

- **INV-1 Treasury Permissioning:** Unauthorized `Treasury.payout()` calls revert
- **INV-2 Raffle State Guard:** `performUpkeep()` reverts when conditions are not met
- **INV-3 VRF One-Time Consumption:** Repeated fulfillment of the same `requestId` reverts
- **INV-4 Raffle Lifecycle Integrity:** Entry → Upkeep → Fulfillment completes a round and returns state to `OPEN`
- **INV-5 DiceGame Settlement Stability:** Multiple concurrent bets settle correctly without state corruption

---

## 10. Known Limitations

1. **Asynchronous Settlement:** VRF fulfillment introduces latency (typically 2-3 blocks on testnets).
2. **MEV Exposure:** Transactions in the public mempool are visible to block builders and searchers.
3. **Gas Cost Variability:** Gas costs fluctuate based on network conditions and storage access patterns.
4. **No Upgradeability:** Contracts are immutable; fixes require redeployment.
5. **Economic Sustainability:** Platform viability depends on appropriate configuration of `minBet`, `maxBet`, house edge, and Treasury funding.

---

## 11. Conclusion

The platform implements a security-focused architecture with the following key properties:

- **Randomness Integrity:** Chainlink VRF integration eliminates predictability and manipulation risks
- **State Machine Enforcement:** Strict state transitions prevent double-settlement and unauthorized state changes
- **Fund Isolation:** Treasury abstraction separates fund management from game logic
- **Comprehensive Testing:** Invariant validation and >90% line coverage provide strong assurance
- **Static Analysis Verification:** No critical vulnerabilities detected by automated tools

The system mitigates major smart contract vulnerabilities and satisfies course security requirements. All identified limitations are architectural trade-offs rather than exploitable vulnerabilities.

