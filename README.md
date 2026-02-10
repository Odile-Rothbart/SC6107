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

## Dependencies
Note: This project uses Solidity 0.8.16, so OpenZeppelin is pinned to @openzeppelin/contracts@4.9.6