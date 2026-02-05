# Team Guide
## 1. Repository Structure
- `contracts/` Solidity smart contracts (Hardhat)
- `test/` Hardhat tests (only our tests; template tests are archived)
- `frontend/` Frontend (TBD)
- `docs/` Documentation (design, API, demo notes)
- `scripts/` Utility scripts

## 2. Quick Start (Local)
```bash
npm install
npx hardhat compile
npx hardhat test
```

## Dependencies
Note: This project uses Solidity 0.8.16, so OpenZeppelin is pinned to @openzeppelin/contracts@4.9.6