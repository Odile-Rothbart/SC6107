"use client";

import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWatchContractEvent, usePublicClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { formatEther, parseEther } from "viem";
import Link from "next/link";
import { useState, useEffect } from "react";

// DiceGame contract address
// For production: set NEXT_PUBLIC_DICEGAME_ADDRESS in .env.local
// For development: update this address after running deployment script (04-deploy-dicegame.ts)
const DICEGAME_ADDRESS = (process.env.NEXT_PUBLIC_DICE_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
// DiceGame contract ABI (only the functions we need)
const DICEGAME_ABI = [
  {
    inputs: [{ name: "choice", type: "uint8" }],
    name: "placeBet",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "betId", type: "uint256" }],
    name: "getBet",
    outputs: [
      {
        components: [
          { name: "betId", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "player", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "choice", type: "uint8" },
          { name: "diceResult", type: "uint8" },
          { name: "payout", type: "uint256" },
          { name: "timestamp", type: "uint64" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "player", type: "address" }],
    name: "getPlayerBets",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getMinBet",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getMaxBet",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "betAmount", type: "uint256" }],
    name: "calculatePayout",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "betId", type: "uint256" },
      { indexed: true, name: "player", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "choice", type: "uint8" },
      { indexed: false, name: "timestamp", type: "uint64" },
    ],
    name: "BetPlaced",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "betId", type: "uint256" },
      { indexed: true, name: "player", type: "address" },
      { indexed: false, name: "diceResult", type: "uint8" },
      { indexed: false, name: "won", type: "bool" },
      { indexed: false, name: "payout", type: "uint256" },
    ],
    name: "BetSettled",
    type: "event",
  },
] as const;

// Bet status enum
enum BetStatus {
  OPEN = 0,
  CALCULATING = 1,
  SETTLED = 2,
}

const statusText = {
  [BetStatus.OPEN]: "Open",
  [BetStatus.CALCULATING]: "Rolling...",
  [BetStatus.SETTLED]: "Settled",
};

export default function DiceGamePage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();

  const [selectedChoice, setSelectedChoice] = useState<number>(1);
  const [betAmount, setBetAmount] = useState<string>("0.01");
  const [playerBets, setPlayerBets] = useState<any[]>([]);
  const [latestBet, setLatestBet] = useState<any>(null);

  // Read min and max bet
  const { data: minBet } = useReadContract({
    address: DICEGAME_ADDRESS,
    abi: DICEGAME_ABI,
    functionName: "getMinBet",
  });

  const { data: maxBet } = useReadContract({
    address: DICEGAME_ADDRESS,
    abi: DICEGAME_ABI,
    functionName: "getMaxBet",
  });

  // Read player's bets
  const { data: betIds, refetch: refetchBetIds } = useReadContract({
    address: DICEGAME_ADDRESS,
    abi: DICEGAME_ABI,
    functionName: "getPlayerBets",
    args: address ? [address] : undefined,
  });

  // Calculate expected payout
  const { data: expectedPayout } = useReadContract({
    address: DICEGAME_ADDRESS,
    abi: DICEGAME_ABI,
    functionName: "calculatePayout",
    args: betAmount ? [parseEther(betAmount)] : undefined,
  });

  // Place bet
  const { writeContract: placeBet, isPending: isPlacingBet } = useWriteContract();

  // Watch for BetPlaced events
  useWatchContractEvent({
    address: DICEGAME_ADDRESS,
    abi: DICEGAME_ABI,
    eventName: "BetPlaced",
    onLogs(logs) {
      console.log("BetPlaced event:", logs);
      // Refetch player bets
      refetchBetIds();
    },
  });

  // Watch for BetSettled events
  useWatchContractEvent({
    address: DICEGAME_ADDRESS,
    abi: DICEGAME_ABI,
    eventName: "BetSettled",
    onLogs(logs) {
      console.log("BetSettled event:", logs);
      logs.forEach((log: any) => {
        if (log.args.player?.toLowerCase() === address?.toLowerCase()) {
          // Update latest bet
          const betId = log.args.betId;
          fetchBetDetails(Number(betId));
        }
      });
      // Refetch player bets
      refetchBetIds();
    },
  });

  // Fetch bet details (using publicClient instead of useReadContract hook)
  const fetchBetDetails = async (betId: number) => {
    if (!publicClient) return;
    
    try {
      const data = await publicClient.readContract({
        address: DICEGAME_ADDRESS,
        abi: DICEGAME_ABI,
        functionName: "getBet",
        args: [BigInt(betId)],
      });
      if (data) {
        setLatestBet(data);
      }
    } catch (error) {
      console.error("Error fetching bet:", error);
    }
  };

  // Load all player bets when betIds change
  useEffect(() => {
    const loadPlayerBets = async () => {
      if (!publicClient || !betIds || betIds.length === 0) {
        setPlayerBets([]);
        return;
      }

      try {
        const betsPromises = betIds.map((betId: bigint) =>
          publicClient.readContract({
            address: DICEGAME_ADDRESS,
            abi: DICEGAME_ABI,
            functionName: "getBet",
            args: [betId],
          })
        );

        const bets = await Promise.all(betsPromises);
        setPlayerBets(bets.reverse()); // Show newest first
        
        // Set latest bet
        if (bets.length > 0) {
          setLatestBet(bets[bets.length - 1]);
        }
      } catch (error) {
        console.error("Error loading player bets:", error);
      }
    };

    loadPlayerBets();
  }, [betIds, publicClient]);

  // Note: Loading multiple bets in a loop is removed because useReadContract 
  // cannot be called inside loops or async functions (React Hooks rules).
  // Consider using the most recent bet from BetPlaced/BetSettled events instead.

  const handlePlaceBet = () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    if (selectedChoice < 1 || selectedChoice > 6) {
      alert("Please select a number between 1 and 6");
      return;
    }

    const amount = parseEther(betAmount);
    if (minBet && amount < minBet) {
      alert(`Bet amount must be at least ${formatEther(minBet)} ETH`);
      return;
    }
    if (maxBet && amount > maxBet) {
      alert(`Bet amount must be at most ${formatEther(maxBet)} ETH`);
      return;
    }

    placeBet({
      address: DICEGAME_ADDRESS,
      abi: DICEGAME_ABI,
      functionName: "placeBet",
      args: [selectedChoice],
      value: amount,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="app-title">
              🎲 DiceGame
              <span className="muted text-lg font-medium">Game</span>
            </div>
            <div>
              {isConnected ? (
                <div className="flex items-center space-x-4">
                  <Link href="/" className="btn">
                              ← Back
                            </Link>
                  <span className="text-sm">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <button
                    onClick={() => disconnect()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => connect({ connector: injected() })}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Place Bet Section */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold mb-6">🎲 Roll the Dice</h2>
            
            {/* Dice Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3">
                Choose your number (1-6):
              </label>
              <div className="grid grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    onClick={() => setSelectedChoice(num)}
                    className={`
                      aspect-square rounded-xl text-2xl font-bold transition
                      ${selectedChoice === num
                        ? "bg-purple-600 ring-4 ring-purple-400"
                        : "bg-white/20 hover:bg-white/30"
                      }
                    `}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Bet Amount */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Bet Amount (ETH):
              </label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                step="0.001"
                min={minBet ? formatEther(minBet) : "0.001"}
                max={maxBet ? formatEther(maxBet) : "1"}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="0.01"
              />
              <div className="mt-2 text-xs text-gray-300">
                Min: {minBet ? formatEther(minBet) : "..."} ETH | Max: {maxBet ? formatEther(maxBet) : "..."} ETH
              </div>
            </div>

            {/* Expected Payout */}
            {expectedPayout && (
              <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                <div className="text-sm text-gray-300">Expected payout if you win:</div>
                <div className="text-2xl font-bold text-green-400">
                  {formatEther(expectedPayout)} ETH
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  (6x multiplier with 2% house edge)
                </div>
              </div>
            )}

            {/* Place Bet Button */}
            <button
              onClick={handlePlaceBet}
              disabled={!isConnected || isPlacingBet}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg font-bold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPlacingBet ? "Placing Bet..." : "🎲 Place Bet"}
            </button>
          </div>

          {/* Latest Bet Result */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold mb-6">📊 Latest Result</h2>
            
            {latestBet ? (
              <div className="space-y-4">
                {/* Bet Info */}
                <div className="p-4 bg-white/5 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">Bet ID</div>
                      <div className="font-bold">#{latestBet.betId.toString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Status</div>
                      <div className="font-bold">{statusText[latestBet.status as BetStatus]}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Your Choice</div>
                      <div className="font-bold text-2xl">🎲 {latestBet.choice}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Bet Amount</div>
                      <div className="font-bold">{formatEther(latestBet.amount)} ETH</div>
                    </div>
                  </div>
                </div>

                {/* Result (if settled) */}
                {latestBet.status === BetStatus.SETTLED && (
                  <div className={`p-6 rounded-xl text-center ${
                    latestBet.diceResult === latestBet.choice
                      ? "bg-green-500/20 border-2 border-green-500"
                      : "bg-red-500/20 border-2 border-red-500"
                  }`}>
                    <div className="text-6xl mb-4">
                      {latestBet.diceResult === latestBet.choice ? "🎉" : "😢"}
                    </div>
                    <div className="text-3xl font-bold mb-2">
                      Dice rolled: {latestBet.diceResult}
                    </div>
                    <div className="text-xl">
                      {latestBet.diceResult === latestBet.choice ? (
                        <>
                          <div className="text-green-400 font-bold mb-2">YOU WON!</div>
                          <div className="text-2xl">
                            +{formatEther(latestBet.payout)} ETH
                          </div>
                        </>
                      ) : (
                        <div className="text-red-400 font-bold">You Lost</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Waiting for result */}
                {latestBet.status === BetStatus.CALCULATING && (
                  <div className="p-6 bg-yellow-500/20 border-2 border-yellow-500 rounded-xl text-center">
                    <div className="text-4xl mb-4 animate-spin">🎲</div>
                    <div className="text-xl font-bold">Rolling the dice...</div>
                    <div className="text-sm text-gray-300 mt-2">
                      Waiting for VRF randomness
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12">
                <div className="text-4xl mb-4">🎲</div>
                <div>No bets yet. Place a bet to start playing!</div>
              </div>
            )}
          </div>
        </div>

        {/* Bet History */}
        {playerBets.length > 0 && (
          <div className="mt-8 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold mb-6">📜 Recent Bets</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Choice</th>
                    <th className="px-4 py-2 text-left">Amount</th>
                    <th className="px-4 py-2 text-left">Result</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {playerBets.map((bet) => (
                    <tr key={bet.betId.toString()} className="border-b border-white/10">
                      <td className="px-4 py-3">#{bet.betId.toString()}</td>
                      <td className="px-4 py-3">🎲 {bet.choice}</td>
                      <td className="px-4 py-3">{formatEther(bet.amount)} ETH</td>
                      <td className="px-4 py-3">
                        {bet.status === BetStatus.SETTLED ? (
                          <span>{bet.diceResult}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          bet.status === BetStatus.SETTLED
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {statusText[bet.status as BetStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {bet.status === BetStatus.SETTLED && bet.payout > 0 ? (
                          <span className="text-green-400 font-bold">
                            +{formatEther(bet.payout)} ETH
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Game Rules */}
        <div className="mt-8 bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold mb-4">ℹ️ How to Play</h3>
          <div className="space-y-2 text-sm text-gray-300">
            <p>1. Connect your wallet and ensure you have some ETH</p>
            <p>2. Choose a number between 1 and 6</p>
            <p>3. Enter your bet amount (min: {minBet ? formatEther(minBet) : "..."} ETH, max: {maxBet ? formatEther(maxBet) : "..."} ETH)</p>
            <p>4. Click "Place Bet" and confirm the transaction</p>
            <p>5. Wait for the dice to roll (using Chainlink VRF for provably fair randomness)</p>
            <p>6. If your number matches, you win 6x your bet (minus 2% house edge = 5.88x)</p>
          </div>
        </div>
    </main>
    </div>
  );
}
