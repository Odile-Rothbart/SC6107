# Architecture & System Design

## 1. Project Overview
**Project Name**: Decentralized Randomness Gaming Platform
**Type**: Option 4 (Verifiable Randomness Game)

This platform demonstrates a secure, transparent, and verifiable gaming ecosystem built on Ethereum (Sepolia Testnet). It leverages **Chainlink VRF (Verifiable Random Function)** to ensure true randomness for all game outcomes, decoupling the RNG (Random Number Generation) logic from the game mechanics.

The system consists of two distinct games:
1.  **DiceGame**: A player-vs-house betting game with instant settlement.
2.  **Raffle**: A pooled lottery system where users buy tickets and a winner is drawn periodically.

---

## 2. System Components

The architecture follows a modular design to ensure security and upgradeability.

### 2.1 Smart Contracts
* **`platform/RandomnessProvider.sol`**:
    * The core infrastructure layer. It acts as the **VRF Consumer**, wrapping the Chainlink Coordinator interactions.
    * **Role**: Receives randomness requests from authorized games, forwards them to Chainlink, and routes the callback to the specific game contract.
* **`platform/Treasury.sol`**:
    * The vault managing the platform's liquidity.
    * **Role**: Holds all funds. Only authorized Game contracts can request payouts to winners. Separates fund management from game logic.
* **`games/DiceGame.sol`**:
    * **Logic**: Users bet on specific outcomes (e.g., Roll < 50).
    * **Flow**: Immediate `requestRandomWords` upon betting.
* **`games/Raffle.sol`**:
    * **Logic**: Users buy tickets to enter a pool.
    * **Flow**: Round-based. A keeper or admin triggers the draw, which requests randomness to select a winner index.

### 2.2 Frontend
* **Tech Stack**: Next.js, Wagmi, Viem, TailwindCSS.
* **Role**: Provides a user interface for wallet connection, game interaction, and event monitoring (listening for `RequestSent` and `WinnerPicked` events).

---

## 3. System Architecture Diagram

This diagram illustrates the interaction between the User, our Protocol Contracts, and the external Chainlink Oracle.

```mermaid
graph TD
    User([User / Player])
    subgraph "Frontend (Next.js)"
        UI[Web Interface]
    end
    
    subgraph "Protocol Smart Contracts"
        Game[Game Contract\n(Dice / Raffle)]
        Provider[RandomnessProvider]
        Treasury[Treasury Contract]
    end
    
    subgraph "External Services"
        VRF[Chainlink VRF Coordinator]
    end

    User -->|1. Connect & Bet| UI
    UI -->|2. Transaction: bet()| Game
    Game -->|3. Request Randomness| Provider
    Provider -->|4. Request RandomWords| VRF
    VRF -- Off-chain RNG Generation --> VRF
    VRF -->|5. Fulfill (Callback)| Provider
    Provider -->|6. Route Callback| Game
    Game -->|7. Settle & Calculate Win| Game
    Game -.->|8. Payout (if win)| Treasury
    Treasury -->|9. Transfer ETH| User