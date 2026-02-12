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

## Dependencies
Note: This project uses Solidity 0.8.16, so OpenZeppelin is pinned to @openzeppelin/contracts@4.9.6