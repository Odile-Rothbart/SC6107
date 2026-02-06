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
npx hardhat deploy --tags Treasury --network localhost
```

Copy the printed Treasury address.

### 4) Frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_TREASURY_ADDRESS=<TREASURY_ADDRESS>
```

Run:

```bash
cd frontend
npm install
npm run dev
```

## Dependencies
Note: This project uses Solidity 0.8.16, so OpenZeppelin is pinned to @openzeppelin/contracts@4.9.6