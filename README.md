# 🎲 Trustless Gaming Platform

> An On-Chain Verifiable Randomness Gaming Platform powered by Chainlink VRF v2.5

[![Solidity](https://img.shields.io/badge/Solidity-0.8.16-blue)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.22.0-yellow)](https://hardhat.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.1.3-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

A decentralized gaming platform featuring provably fair games powered by Chainlink VRF (Verifiable Random Function). Built for SC6107 course project.

## 📋 Table of Contents

- [Overview](#-overview)
- [Deployment](#-deployment)
- [User Guide](#-user-guide)

## � Overview

### Features

- **🎲 DiceGame**: Instant-settlement dice betting with 6x multiplier
- **🎟️ Raffle**: Time-based lottery with automated winner selection
- **🔐 Provably Fair**: All randomness verified on-chain via Chainlink VRF v2.5
- **💰 Centralized Treasury**: Unified fund management with emergency controls
- **⚡ Gas Optimized**: Custom errors, immutables, and efficient storage patterns
- **🎨 Modern UI**: Next.js 15 frontend with wagmi v2 and RainbowKit

### Smart Contracts

| Contract | Description | Test Coverage |
|----------|-------------|---------------|
| `DiceGame.sol` | Dice betting game with instant settlement | 98.36% |
| `Raffle.sol` | Time-based lottery with Chainlink Automation | 87.32% |
| `RandomnessProvider.sol` | VRF v2.5 integration layer | 100% |
| `Treasury.sol` | Centralized fund management | 96.77% |

### Technology Stack

- Solidity 0.8.16
- Hardhat for development and testing
- Chainlink VRF v2.5 for verifiable randomness
- Chainlink Automation for scheduled tasks
- Next.js 15 + wagmi v2 + RainbowKit for frontend
- OpenZeppelin contracts for security

## 🚀 Deployment

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- MetaMask or compatible Web3 wallet
- Sepolia testnet ETH (for deployment)

### Local Development

1. **Install dependencies**:
```bash
npm install
```

2. **Compile contracts**:
```bash
npx hardhat compile
```

3. **Run tests**:
```bash
npx hardhat test
```

4. **Start local blockchain**:
```bash
npx hardhat node --no-deploy
```

5. **Deploy contracts locally**:
```bash
npx hardhat deploy --network localhost
```

6. **Configure frontend**:

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_TREASURY_ADDRESS=<TREASURY_ADDRESS>
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_DICE_ADDRESS=<DICEGAME_ADDRESS>
NEXT_PUBLIC_RAFFLE_ADDRESS=<RAFFLE_ADDRESS>
NEXT_PUBLIC_RANDOMNESS_PROVIDER_ADDRESS=<RANDOMNESS_PROVIDER_ADDRESS>
NEXT_PUBLIC_HARDHAT_RPC_URL=http://127.0.0.1:8545
```

7. **Start frontend**:
```bash
cd frontend
npm install
npm run dev
```

### Testnet Deployment (Sepolia)

1. **Get Sepolia ETH**:
   - Alchemy: https://sepoliafaucet.com/
   - Chainlink: https://faucets.chain.link/sepolia
   - Recommended: 0.5 ETH for deployment and testing

2. **Create VRF Subscription**:
   - Visit https://vrf.chain.link/sepolia
   - Create a new subscription
   - Copy the subscription ID

3. **Configure environment**:

Create `.env` file in project root:
```env
SEPOLIA_RPC_URL=<YOUR_RPC_URL>
PRIVATE_KEY=<YOUR_PRIVATE_KEY>
ETHERSCAN_API_KEY=<YOUR_ETHERSCAN_KEY>
```

4. **Update VRF configuration**:

Edit `utils.data.ts` with your subscription ID:
```typescript
subscriptionId: "YOUR_SUBSCRIPTION_ID"
```

5. **Deploy contracts**:
```bash
npx hardhat deploy --network sepolia --tags all
npx hardhat deploy --network sepolia --tags dicegame
```

6. **Configure frontend**:

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_TREASURY_ADDRESS=<DEPLOYED_TREASURY_ADDRESS>
NEXT_PUBLIC_RANDOMNESS_PROVIDER_ADDRESS=<DEPLOYED_PROVIDER_ADDRESS>
NEXT_PUBLIC_RAFFLE_ADDRESS=<DEPLOYED_RAFFLE_ADDRESS>
NEXT_PUBLIC_DICE_ADDRESS=<DEPLOYED_DICEGAME_ADDRESS>
NEXT_PUBLIC_CHAIN_ID=11155111
```

7. **Start frontend**:
```bash
cd frontend
npm install
npm run dev
```

## 👤 User Guide

### Playing DiceGame

1. **Connect Wallet**: Click "Connect Wallet" and select your wallet
2. **Place Bet**: 
   - Choose a number (1-6)
   - Enter bet amount (minimum 0.001 ETH)
   - Click "Place Bet"
3. **Wait for Result**: VRF callback settles the bet automatically (15-30 seconds)
4. **Check Result**: Win 6x your bet if you guessed correctly

### Playing Raffle

1. **Enter Raffle**: 
   - Click "Enter Raffle" 
   - Pay 0.01 ETH entry fee
2. **Wait for Draw**: Raffle draws every 5 minutes automatically
3. **Check Winner**: Winner receives 100% of the prize pool

### Troubleshooting

**Frontend shows 0x00...00 address**:
- Restart the frontend development server
- Clear browser cache
- Verify `.env.local` is in the `frontend/` directory

**VRF callback not arriving**:
- Check VRF subscription has sufficient ETH balance
- Wait 1-2 minutes for callback
- Check transaction on Etherscan for errors

**Transaction fails**:
- Ensure you have enough Sepolia ETH for gas fees
- Check contract addresses are correct

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Architecture Documentation](docs/architecture.md)**: System design and component interactions
- **[Test Coverage Report](docs/test-coverage.md)**: Detailed test results (89.74% coverage)
- **[Gas Optimization Report](docs/gas-optimization.md)**: Gas analysis and optimization strategies
- **[Security Analysis](docs/security-analysis.md)**: Security considerations and best practices

## 🛠️ Dependencies

### Smart Contracts
- Solidity: `0.8.16`
- Hardhat: `^2.22.0`
- OpenZeppelin Contracts: `4.9.6`
- Chainlink Contracts: `^1.2.0`

### Frontend
- Next.js: `15.1.3`
- React: `19.0.0`
- wagmi: `^2.13.6`
- viem: `^2.21.54`
- RainbowKit: `^2.2.1`
- TailwindCSS: `^3.4.1`

## 📁 Project Structure

```
.
├── contracts/
│   ├── src/
│   │   ├── games/          # Game contracts
│   │   ├── platform/       # Core platform contracts
│   │   └── mocks/          # Testing mocks
│   └── test/               # Contract tests
├── scripts/                # Deployment scripts
├── frontend/               # Next.js frontend
│   ├── app/
│   │   ├── DiceGame/
│   │   ├── raffle/
│   │   └── providers.tsx
│   └── public/
├── docs/                   # Documentation
├── hardhat.config.ts
├── utils.data.ts
└── README.md
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Student**: Yu Yingzi, Zhang Muzi, Xu Wenjun, Long Cai
- **Year**: 2026

## 🙏 Acknowledgments

- [Chainlink](https://chain.link/) for VRF and Automation services
- [OpenZeppelin](https://openzeppelin.com/) for secure contract libraries
- [Hardhat](https://hardhat.org/) for development framework
- [wagmi](https://wagmi.sh/) and [RainbowKit](https://rainbowkit.com/) for Web3 integration

---

**⚠️ Disclaimer**: This is an educational project deployed on Sepolia testnet. Do not use with real funds on mainnet without proper auditing.