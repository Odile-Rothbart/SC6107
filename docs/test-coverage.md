# Test & Coverage Report

**Project Name**:Trustless Gaming: An On-Chain Verifiable Randomness Platform
**Type**: Option 4 (Verifiable Randomness Game)

---

## 1. Testing Goals & Scope

### Testing Goals
- Achieve **>=80% local line coverage** for Solidity contracts.
- Provide required test types:
  - **Unit tests**
  - **Integration tests**
  - **Invariant / fuzz-style tests**
  - **Gas optimization tests**
- (If feasible) Provide **testnet acceptance evidence** using real Chainlink VRF (addresses + tx hashes + events).

### Scope
- **Included (tests + coverage):** contracts under `contracts/src/**`
- **Not included in coverage:** `scripts/` and `frontend/`
- **Frontend validation:** manual functional checks

---

## 2. Project Under Test (Repo Structure)

### Contracts
- Games:
  - `contracts/src/games/DiceGame.sol`
  - `contracts/src/games/Raffle.sol`
- Platform:
  - `contracts/src/platform/RandomnessProvider.sol`
  - `contracts/src/platform/Treasury.sol`
- Local mock (Hardhat-only):
  - `contracts/src/mocks/VRFCoordinatorMock.sol`

### Tests (Hardhat)
- Games:
  - `contracts/test/games/DiceGame.test.ts`
  - `contracts/test/games/Raffle.test.ts`
- Platform:
  - `contracts/test/platform/RandomnessProvider.test.ts`
  - `contracts/test/platform/Treasury.test.ts`
- End-to-end sanity:
  - `contracts/test/smoke.test.ts`
- Invariant-style checks:
  - `contracts/test/invariants.test.ts`
- Gas measurements (receipt-based):
  - `contracts/test/gas.test.ts`

---

## 3. Tooling & Environments

### Local (for coverage + most tests)
- Framework: **Hardhat** (TypeScript tests)
- Coverage: **solidity-coverage**
- Randomness: **VRFCoordinatorMock** used to simulate fulfillment locally

### Testnet (for acceptance evidence)
- Network: Sepolia
- Randomness: **Real Chainlink VRF**
- Evidence format: contract addresses + tx hashes + explorer links + emitted events

---

## 4. How to Run (Local)

### Install & Compile
```bash
npm install
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

### Run Coverage (>=80% line coverage)

```bash
npx hardhat coverage
```

* Output: `coverage/` and `coverage/lcov-report/`

### Gas Measurement (for gas optimization requirement)

* Method: Local receipt-based gas snapshots using `txReceipt.gasUsed` (Hardhat), implemented in `contracts/test/gas.test.ts`
* Output/Evidence: Console output table from `npx hardhat test contracts/test/gas.test.ts` (screenshot/log) + gas table recorded in Section 5.4

---

# Part A — Local Testing & Coverage (Hardhat + Mock VRF)

## 5. Test Plan by Category

### 5.1 Unit Tests
Unit tests are implemented per-module (games/platform) under Hardhat. Local randomness is driven deterministically via `VRFCoordinatorV2Mock`.

- `test/platform/RandomnessProvider.test.ts` — unit tests for VRF request/fulfillment path.  
  Coverage: 100% stmts/branches/funcs/lines.

- `test/platform/Treasury.test.ts` — unit tests for treasury access control and payout/withdraw behaviors.  
  Coverage: 96.77% lines (uncovered: 104).

- `test/games/DiceGame.test.ts` — unit tests for bet lifecycle (input guards, request→settle linkage).  
  Coverage: 98.36% lines (uncovered: 278).

- `test/games/Raffle.test.ts` — unit tests for raffle lifecycle (entry rules, upkeep/draw gating, winner finalization).  
  Coverage: 87.32% lines (uncovered: 287–289).

### 5.2 Integration Tests (End-to-End)
End-to-end sanity is verified via `contracts/test/smoke.test.ts` across
**Game ↔ RandomnessProvider ↔ VRFCoordinatorV2Mock ↔ Treasury**:

- Dice: `placeBet` → request randomness → mock fulfill → round/bet reaches settled state.
- Raffle: `enterRaffle` → time elapse → `performUpkeep` → mock fulfill → winner is produced and state returns to OPEN.

### 5.3 Invariant-Style Checks

Invariant-style properties are enforced via dedicated assertions in `contracts/test/invariants.test.ts` (Hardhat + `VRFCoordinatorV2Mock`):

- **INV-1 Treasury permissioning:** `Treasury.payout` rejects unauthorized callers (revert asserted).
- **INV-2 Raffle state machine:** `performUpkeep` reverts when upkeep conditions are not met.
- **INV-3 One-time VRF consumption (Dice):** the same `requestId` cannot be fulfilled twice; repeated fulfillment is rejected and the bet remains settled.
- **INV-4 End-to-end lifecycle integrity (Raffle):** enter → upkeep → VRF fulfill completes a round, records a non-zero winner, and resets the raffle state to `OPEN`.
- **INV-5 Repeated trials (Dice):** multiple randomized bets settle successfully without breaking core state (player linkage and settled status).


### 5.4 Gas Optimization Tests / Measurements

Gas is measured locally on Hardhat using `txReceipt.gasUsed` (`contracts/test/gas.test.ts`). 

| Operation | GasUsed (local) |
| --- | ---: |
| Dice.placeBet | 292,589 |
| VRF.fulfillRandomWords (Dice path) | 55,857 |
| Raffle.enterRaffle (p1) | 94,184 |
| Raffle.enterRaffle (p2) | 59,984 |
| Raffle.performUpkeep | 129,110 |
| VRF.fulfillRandomWords (Raffle path) | 158,716 |
| Treasury.adminWithdraw | 32,522 |

Notes: these numbers are collected on the local Hardhat network; gas on testnet may vary due to network/basefee and warm/cold storage effects.


---

## 6. Feature → Test Mapping (by file)

- `contracts/src/games/DiceGame.sol`
  - Unit: `test/games/DiceGame.test.ts`
  - E2E sanity: `contracts/test/smoke.test.ts`
  - Invariants: `contracts/test/invariants.test.ts`

- `contracts/src/games/Raffle.sol`
  - Unit: `test/games/Raffle.test.ts`
  - E2E sanity: `contracts/test/smoke.test.ts`
  - Invariants: `contracts/test/invariants.test.ts`

- `contracts/src/platform/RandomnessProvider.sol`
  - Unit: `test/platform/RandomnessProvider.test.ts`
  - E2E sanity: `contracts/test/smoke.test.ts` (via VRF fulfillment paths)

- `contracts/src/platform/Treasury.sol`
  - Unit: `test/platform/Treasury.test.ts`
  - Invariants: `contracts/test/invariants.test.ts` (permissioning checks)

- Gas measurements (hot paths snapshot)
  - `contracts/test/gas.test.ts`

---

## 7. Coverage Report

**Tooling:** Hardhat + `solidity-coverage`  
**Command:** `npx hardhat coverage`

### Coverage Summary (All files)

- Statements: **91.13%**
- Branches: **71.74%**
- Functions: **87.80%**
- Lines: **93.64%** (meets >=80% requirement)

### Per-Contract Coverage

| Contract                          | % Stmts | % Branch | % Funcs | % Lines | Uncovered lines |
| --------------------------------- | ------: | -------: | ------: | ------: | --------------- |
| `games/DiceGame.sol`              |   97.62 |    82.14 |   92.31 |   98.36 | 278             |
| `games/Raffle.sol`                |   83.02 |    61.54 |   80.00 |   87.32 | 287–289         |
| `mocks/VRFCoordinatorMock.sol`    |  100.00 |   100.00 |  100.00 |  100.00 | —               |
| `platform/RandomnessProvider.sol` |  100.00 |   100.00 |  100.00 |  100.00 | —               |
| `platform/Treasury.sol`           |   96.00 |    71.05 |   90.00 |   96.77 | 104             |


---

# Part B — Testnet Acceptance Evidence (Real Chainlink VRF)

## 8. Testnet Setup

* Network: TBD
* VRF Coordinator address: TBD
* subscriptionId: TBD
* keyHash / callbackGasLimit / confirmations / numWords: TBD
* Consumer added to subscription: tx link TBD

## 9. Testnet End-to-End Checklist (Evidence-based)

> Final submission will include: contract addresses + tx hashes + explorer links + key events.

1. Deploy contracts (Treasury / RandomnessProvider / DiceGame / Raffle): addresses TBD
2. Initialize roles/fees/config: tx TBD
3. Add VRF consumer to subscription: tx TBD
4. Dice: bet/enter: tx TBD
5. Dice: request VRF (requestId event): tx TBD
6. Dice: fulfill observed (fulfill event): TBD
7. Dice: settle + payout evidence (tx + balance change): TBD
8. Raffle: enter: tx TBD
9. Raffle: draw/request VRF (requestId event): tx TBD
10. Raffle: fulfill + winner event: TBD
11. Raffle: payout/claim evidence: TBD

## 10. Frontend Manual Functional Checks (Optional)

* Configure `frontend/.env.local` with deployed addresses
* Connect wallet
* Dice page: place bet → tx confirmed → result displayed
* Raffle page: enter → draw → winner/result displayed
  Evidence: screenshots TBD

---

## 11. Known Issues / Gaps (Current Status)

- **Testnet evidence pending:** Part B (testnet acceptance with real Chainlink VRF) will be completed after deployment, with deployed addresses and transaction hashes added as evidence.
- **Uncovered lines remain minimal:** coverage gaps are limited to a few specific lines (DiceGame: 278; Raffle: 287–289; Treasury: 104), which are not exercised by the current local unit/E2E scenarios.
- **Gas reporting scope:** gas numbers are measured locally via `txReceipt.gasUsed` (Hardhat). Testnet gas/cost may vary due to network/basefee and warm/cold storage effects.
