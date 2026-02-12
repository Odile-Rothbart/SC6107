# 🎲 Trustless Gaming Platform

> An On-Chain Verifiable Randomness Gaming Platform powered by Chainlink VRF v2.5

[![Solidity](https://img.shields.io/badge/Solidity-0.8.16-blue)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.22.0-yellow)](https://hardhat.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.1.3-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

A decentralized gaming platform featuring provably fair games powered by Chainlink VRF (Verifiable Random Function). Built for SC6107 course project.

## 🌟 Features

- **🎲 DiceGame**: Instant-settlement dice betting with 6x multiplier
- **🎟️ Raffle**: Time-based lottery with automated winner selection
- **🔐 Provably Fair**: All randomness verified on-chain via Chainlink VRF v2.5
- **💰 Centralized Treasury**: Unified fund management with emergency controls
- **⚡ Gas Optimized**: Custom errors, immutables, and efficient storage patterns
- **🎨 Modern UI**: Next.js 15 frontend with wagmi v2 and RainbowKit

## 📋 Table of Contents

- [Architecture](#-architecture)
- [Smart Contracts](#-smart-contracts)
- [Live Demo](#-live-demo)
- [Quick Start](#-quick-start)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [Documentation](#-documentation)
- [Gas Optimization](#-gas-optimization)
- [Security](#-security)
- [Troubleshooting](#-troubleshooting)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│                  (Next.js + wagmi + RainbowKit)             │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐       ┌───────▼────────┐
│   DiceGame     │       │     Raffle     │
│                │       │                │
│ • placeBet()   │       │ • enterRaffle()│
│ • settleBet()  │       │ • performUpkeep│
└───────┬────────┘       └───────┬────────┘
        │                        │
        └────────────┬───────────┘
                     │
            ┌────────▼────────────┐
            │ RandomnessProvider  │
            │                     │
            │ • requestRandomWords│
            │ • fulfillRandomWords│
            └────────┬────────────┘
                     │
            ┌────────▼────────────┐
            │  Chainlink VRF v2.5 │
            │  (Sepolia Testnet)  │
            └─────────────────────┘
                     │
            ┌────────▼────────────┐
            │     Treasury        │
            │                     │
            │ • payout()          │
            │ • adminWithdraw()   │
            └─────────────────────┘
```

### Key Design Patterns

- **Centralized Randomness**: Single `RandomnessProvider` serves all games
- **Treasury Pattern**: Unified fund management with access control
- **State Machine**: Prevents double-settlement and re-entrancy
- **Event-Driven**: Frontend updates via contract events

## 📦 Smart Contracts

### Core Contracts

| Contract | Description | Lines of Code | Test Coverage |
|----------|-------------|---------------|---------------|
| `DiceGame.sol` | Dice betting game with instant settlement | ~280 | 98.36% |
| `Raffle.sol` | Time-based lottery with Chainlink Automation | ~290 | 87.32% |
| `RandomnessProvider.sol` | VRF v2.5 integration layer | ~100 | 100% |
| `Treasury.sol` | Centralized fund management | ~105 | 96.77% |

### Contract Addresses (Sepolia Testnet)

```
Treasury:            0xF062f2A710A9a5dcA35fE0b4280BECf32394C78f
RandomnessProvider:  0x8E03083aF8CCb5b45Dd0fFf12dd45682403dDd5e
Raffle:              0x4E8e5BB5B7f4AE47BBDD9e006E832199dbe68131
DiceGame:            0xDb27dF37443269FD927463aFdE3D115Dc63cEE93
```

**VRF Configuration**:
- VRF Coordinator: `0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B` (VRF v2.5)
- Subscription ID: `36683587491220745217479820823626170780250274537542753984181590465747077635844`
- Key Hash: `0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c` (150 gwei)
- Callback Gas Limit: `500000`

## 🚀 Live Demo

**Frontend**: [https://sc6107.vercel.app/](https://sc6107.vercel.app/)

**Explorer Links**:
- [Treasury](https://sepolia.etherscan.io/address/0xF062f2A710A9a5dcA35fE0b4280BECf32394C78f)
- [DiceGame](https://sepolia.etherscan.io/address/0xDb27dF37443269FD927463aFdE3D115Dc63cEE93)
- [Raffle](https://sepolia.etherscan.io/address/0x4E8e5BB5B7f4AE47BBDD9e006E832199dbe68131)
- [VRF Subscription](https://vrf.chain.link/sepolia)

## 🏃 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- MetaMask or compatible Web3 wallet

### Local Development

## Run (Local)

### 1) Contracts

```bash
npm install
npx hardhat compile
npx hardhat test
```

### 2) Local chain

```bash
npx hardhat node --no-deploy
```

### 3) Deploy Treasury

```bash
npx hardhat deploy --network localhost
```

Copy the printed Treasury address.

### 4) Frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_TREASURY_ADDRESS=<TREASURY_ADDRESS>
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_DICE_ADDRESS=<DICEGAME_ADDRESS>
NEXT_PUBLIC_RAFFLE_ADDRESS=<RAFFLE_ADDRESS>
NEXT_PUBLIC_RANDOMNESS_PROVIDER_ADDRESS=<RANDOMNESS_PROVIDER_ADDRESS>
NEXT_PUBLIC_HARDHAT_RPC_URL=http://127.0.0.1:8545
```

Run:

```bash
cd frontend
npm install
npm run dev
```

## Deploy to Testnet (Sepolia)

### Prerequisites

1. **Get Sepolia ETH**: Obtain test ETH from faucets
   - Alchemy: https://sepoliafaucet.com/
   - Chainlink: https://faucets.chain.link/sepolia
   - Recommended: 0.5 ETH for deployment and testing

2. **Create VRF Subscription**: 
   - Visit https://vrf.chain.link/sepolia
   - Create a new subscription
   - Copy the subscription ID

3. **Configure Environment**:
   Create `.env` file in project root:
   ```env
   SEPOLIA_RPC_URL=<YOUR_RPC_URL>
   PRIVATE_KEY=<YOUR_PRIVATE_KEY>
   ETHERSCAN_API_KEY=<YOUR_ETHERSCAN_KEY>
   ```

### Deployment Steps

1. **Update Configuration**:
   Edit `utils.data.ts` with your VRF subscription ID:
   ```typescript
   subscriptionId: "YOUR_SUBSCRIPTION_ID"
   ```

2. **Deploy All Contracts**:
   ```bash
   npx hardhat deploy --network sepolia --tags all
   ```
   
   This deploys:
   - Treasury
   - RandomnessProvider (configured for ETH payment)
   - Raffle

3. **Deploy DiceGame**:
   ```bash
   npx hardhat deploy --network sepolia --tags dicegame
   ```

4. **Add VRF Consumer**:
   ```bash
   npx hardhat run test-scripts/add-consumer.ts --network sepolia
   ```

5. **Fund Contracts**:
   ```bash
   # Fund Treasury with ETH
   npx hardhat run test-scripts/fund-treasury-small.ts --network sepolia
   
   # Fund VRF subscription with ETH (for VRF requests)
   npx hardhat run test-scripts/fund-vrf-with-eth.ts --network sepolia
   ```

6. **Update Frontend Configuration**:
   Create `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_TREASURY_ADDRESS=<DEPLOYED_TREASURY_ADDRESS>
   NEXT_PUBLIC_RANDOMNESS_PROVIDER_ADDRESS=<DEPLOYED_PROVIDER_ADDRESS>
   NEXT_PUBLIC_RAFFLE_ADDRESS=<DEPLOYED_RAFFLE_ADDRESS>
   NEXT_PUBLIC_DICE_ADDRESS=<DEPLOYED_DICEGAME_ADDRESS>
   NEXT_PUBLIC_CHAIN_ID=11155111
   ```

7. **Start Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### VRF Configuration

The platform uses Chainlink VRF v2.5 with the following configuration:

- **Payment Method**: Native ETH (not LINK tokens)
- **Key Hash**: 500 gwei (only option on Sepolia)
- **Callback Gas Limit**: 500,000
- **Request Confirmations**: 3 blocks

**Important**: 
- VRF requests cost approximately 0.01-0.02 ETH on Sepolia
- Ensure your VRF subscription has sufficient ETH balance
- Monitor balance at: https://vrf.chain.link/sepolia/[YOUR_SUBSCRIPTION_ID]

### Testing

1. **Test Raffle**:
   ```bash
   # Enter raffle (costs 0.01 ETH)
   npx hardhat run test-scripts/enter-raffle.ts --network sepolia
   
   # Wait 5 minutes, then trigger draw
   npx hardhat run test-scripts/manual-perform-upkeep.ts --network sepolia
   
   # Monitor status
   npx hardhat run test-scripts/monitor-raffle-status.ts --network sepolia
   ```

2. **Test DiceGame**:
   - Use the frontend to place bets
   - Results are settled automatically via VRF callback
   - Check your bets: `npx hardhat run test-scripts/check-my-dicegame-bets.ts --network sepolia`

3. **Check Your Wins**:
   ```bash
   npx hardhat run test-scripts/check-my-wins.ts --network sepolia
   ```

### Troubleshooting

**Frontend shows 0x00...00 address**:
- Restart the frontend development server (environment variables only load on startup)
- Clear browser cache
- Verify `.env.local` is in the `frontend/` directory

**VRF callback not arriving**:
- Check VRF subscription has sufficient ETH balance
- Verify RandomnessProvider is added as a consumer
- Check transaction on Etherscan for errors

**Transaction fails**:
- Ensure you have enough Sepolia ETH for gas fees
- Check contract addresses are correct in configuration files

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

### Architecture & Design
- **Architecture Documentation**: System design and component interactions
- **Contract Documentation**: NatSpec comments for all public functions (inline in contracts)

### Testing & Quality
- **[Test Coverage Report](docs/test-coverage.md)**: Detailed test results and coverage metrics
  - Overall coverage: 89.74% lines (exceeds 80% requirement)
  - Unit tests, integration tests, invariant tests
  - Gas measurements and benchmarks
  - Testnet acceptance evidence

### Performance & Security
- **[Gas Optimization Report](docs/gas-optimization.md)**: Gas analysis and optimization strategies
  - DiceGame.placeBet: ~329k gas
  - Raffle.enterRaffle: ~96k gas (first), ~62k gas (subsequent)
  - Detailed optimization techniques and trade-offs
  
- **[Security Analysis](docs/security-analysis.md)**: Security considerations and best practices
  - Access control patterns
  - Re-entrancy protection
  - VRF security model

### Deployment & Operations
- **Deployment Guide**: Step-by-step deployment instructions (this README)
- **User Guide**: How to interact with the application (frontend UI)
- **[Chainlink Automation Setup](配置Chainlink-Automation.md)**: Configure automated upkeep for Raffle

### Additional Resources
- **[VRF Configuration Guide](VRF配置值.md)**: Complete VRF setup parameters
- **[Deployment Summary](最终部署总结.md)**: Latest deployment details and addresses
- **[Troubleshooting Guides](前端环境变量问题.md)**: Common issues and solutions

## ⚡ Gas Optimization

Our platform implements multiple gas optimization techniques:

### Optimization Strategies

1. **Custom Errors** (Solidity 0.8.4+)
   - ~50% reduction in revert gas costs vs `require()` strings
   - Applied across all contracts (22 custom errors total)

2. **Immutable Variables**
   - ~2,100 gas saved per read (SLOAD → direct value)
   - Used for contract addresses and configuration

3. **Storage Caching**
   - ~100 gas saved per cached SLOAD
   - All functions cache frequently accessed storage

4. **Efficient Data Structures**
   - Mapping-based O(1) lookups instead of array iteration
   - Modulo-based random selection (no loops)

5. **State Machine Pattern**
   - Single state check prevents expensive double-settlement
   - Prevents re-entrancy attacks

### Gas Benchmarks

| Operation | Gas Cost | User Pays |
|-----------|----------|-----------|
| DiceGame.placeBet | 329,469 | ✅ Yes |
| DiceGame.fulfillRandomness | 65,201 | ❌ VRF Subscription |
| Raffle.enterRaffle (first) | 95,904 | ✅ Yes |
| Raffle.enterRaffle (subsequent) | 61,704 | ✅ Yes |
| Raffle.performUpkeep | 148,717 | ❌ Automation |
| Raffle.fulfillRandomWords | 172,681 | ❌ VRF Subscription |

**Cost Analysis** (at 30 gwei, ETH = $3,000):
- Place Dice Bet: ~$29.65
- Enter Raffle: ~$8.63 (first) / ~$5.55 (subsequent)
- VRF callbacks: Paid by platform subscription

See [docs/gas-optimization.md](docs/gas-optimization.md) for detailed analysis.

## 🔒 Security

### Security Features

1. **Access Control**
   - Owner-only administrative functions
   - Game-only treasury access via `onlyGame` modifier
   - VRF coordinator validation

2. **Re-entrancy Protection**
   - State updates before external calls (CEI pattern)
   - State machine prevents double-settlement
   - No recursive calls possible

3. **Input Validation**
   - Bet amount limits (min/max)
   - Choice validation (1-6 for dice)
   - Zero address checks

4. **VRF Security**
   - Only VRF coordinator can fulfill requests
   - Request ID tracking prevents replay attacks
   - Randomness cannot be predicted or manipulated

5. **Emergency Controls**
   - Pausable contracts (Treasury)
   - Admin withdraw for emergency recovery
   - Transparent fund management

### Audit Status

- ✅ Comprehensive test coverage (89.74%)
- ✅ Invariant testing for critical properties
- ✅ Gas optimization without security trade-offs
- ⚠️ Not professionally audited (academic project)

See [docs/security-analysis.md](docs/security-analysis.md) for detailed security analysis.

## 🧪 Testing

### Test Coverage

```bash
# Run all tests
npx hardhat test

# Run with coverage
npx hardhat coverage

# Run gas reporter
REPORT_GAS=true npx hardhat test

# Run specific test suite
npx hardhat test contracts/test/games/DiceGame.test.ts
```

### Coverage Summary

| Contract | Statements | Branches | Functions | Lines |
|----------|------------|----------|-----------|-------|
| DiceGame | 97.62% | 82.14% | 92.31% | 98.36% |
| Raffle | 83.02% | 61.54% | 80.00% | 87.32% |
| RandomnessProvider | 100% | 100% | 100% | 100% |
| Treasury | 96.00% | 71.05% | 90.00% | 96.77% |
| **Overall** | **86.52%** | **67.65%** | **84.44%** | **89.74%** |

### Test Types

- **Unit Tests**: Per-contract functionality testing
- **Integration Tests**: End-to-end game flows
- **Invariant Tests**: Critical property verification
- **Gas Tests**: Performance benchmarking

See [docs/test-coverage.md](docs/test-coverage.md) for detailed test report.

## 🛠️ Dependencies

### Smart Contracts
- Solidity: `0.8.16`
- Hardhat: `^2.22.0`
- OpenZeppelin Contracts: `4.9.6` (pinned for Solidity 0.8.16 compatibility)
- Chainlink Contracts: `^1.2.0` (VRF v2.5 support)

### Frontend
- Next.js: `15.1.3`
- React: `19.0.0`
- wagmi: `^2.13.6`
- viem: `^2.21.54`
- RainbowKit: `^2.2.1`
- TailwindCSS: `^3.4.1`

### Development Tools
- TypeScript: `^5`
- Hardhat Deploy: `^0.12.4`
- Solidity Coverage: `^0.8.13`
- Hardhat Gas Reporter: `^2.2.1`

## 📁 Project Structure

```
.
├── contracts/
│   ├── src/
│   │   ├── games/
│   │   │   ├── DiceGame.sol
│   │   │   └── Raffle.sol
│   │   ├── platform/
│   │   │   ├── RandomnessProvider.sol
│   │   │   └── Treasury.sol
│   │   └── mocks/
│   │       └── VRFCoordinatorMock.sol
│   └── test/
│       ├── games/
│       ├── platform/
│       ├── smoke.test.ts
│       ├── invariants.test.ts
│       └── gas.test.ts
├── scripts/
│   ├── 00-deploy-mocks.ts
│   ├── 01-deploy-treasury.ts
│   ├── 02-deploy-randomness-provider.ts
│   ├── 03-deploy-raffle.ts
│   └── 04-deploy-dicegame.ts
├── test-scripts/
│   ├── add-consumer.ts
│   ├── enter-raffle.ts
│   ├── manual-perform-upkeep.ts
│   ├── check-my-dicegame-bets.ts
│   └── ... (various utility scripts)
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── DiceGame/
│   │   ├── raffle/
│   │   └── providers.tsx
│   └── public/
├── docs/
│   ├── test-coverage.md
│   ├── gas-optimization.md
│   └── security-analysis.md
├── deployments/
│   └── sepolia/
│       ├── Treasury.json
│       ├── RandomnessProvider.json
│       ├── Raffle.json
│       └── DiceGame.json
├── hardhat.config.ts
├── utils.data.ts
└── README.md
```

## 🤝 Contributing

This is an academic project for SC6107. Contributions are welcome for educational purposes.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npx hardhat test`)
5. Check coverage (`npx hardhat coverage`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Student**: SC6107 Course Project
- **Course**: Blockchain Technology and Applications
- **Institution**: [Your Institution]
- **Year**: 2026

## 🙏 Acknowledgments

- [Chainlink](https://chain.link/) for VRF and Automation services
- [OpenZeppelin](https://openzeppelin.com/) for secure contract libraries
- [Hardhat](https://hardhat.org/) for development framework
- [wagmi](https://wagmi.sh/) and [RainbowKit](https://rainbowkit.com/) for Web3 integration

## 📞 Support

For questions or issues:
- Open an issue on GitHub
- Check [Troubleshooting](#-troubleshooting) section
- Review documentation in `docs/` directory

---

**⚠️ Disclaimer**: This is an educational project deployed on Sepolia testnet. Do not use with real funds on mainnet without proper auditing.