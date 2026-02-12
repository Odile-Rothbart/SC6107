"use client";

import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
  usePublicClient,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { formatEther } from "viem";
import Link from "next/link";
import { useState, useEffect } from "react";

// Raffle contract address (localhost deployment - updated 2026-02-07)
const RAFFLE_ADDRESS = (process.env.NEXT_PUBLIC_RAFFLE_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

// Raffle contract ABI (only the functions we need)
const RAFFLE_ABI = [
  {
    inputs: [],
    name: "enterRaffle",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "getCurrentRound",
    outputs: [
      { name: "roundId", type: "uint256" },
      { name: "state", type: "uint8" },
      { name: "startTime", type: "uint64" },
      { name: "playerCount", type: "uint256" },
      { name: "prizePool", type: "uint256" },
      { name: "winner", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getEntrancyFee",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getInterval",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTimeUntilDraw",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getNumberOfPlayers",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "roundId", type: "uint256" },
      { indexed: true, name: "player", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "RaffleEntered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "roundId", type: "uint256" },
      { indexed: true, name: "winner", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "WinnerPicked",
    type: "event",
  },
] as const;

const STATE_NAMES = ["OPEN", "CALCULATING", "SETTLED"];

interface WinnerEvent {
  roundId: string;
  winner: string;
  amount: string;
}

export default function RafflePage() {
  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContract, isPending: isWriting } = useWriteContract();
  const publicClient = usePublicClient();

  const [winners, setWinners] = useState<WinnerEvent[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch past WinnerPicked events on mount
  useEffect(() => {
    const fetchPastWinners = async () => {
      if (!mounted || !publicClient || RAFFLE_ADDRESS === "0x0000000000000000000000000000000000000000") return;

      try {
        // Use a reasonable block range (last 1000 blocks or from deployment)
        const currentBlock = await publicClient.getBlockNumber();
        // Raffle was deployed at block 10242393 (approximately)
        const deploymentBlock = BigInt(10242393);
        const fromBlock = currentBlock > BigInt(1000) ? currentBlock - BigInt(1000) : deploymentBlock;

        const logs = await publicClient.getLogs({
          address: RAFFLE_ADDRESS,
          event: {
            type: "event",
            name: "WinnerPicked",
            inputs: [
              { indexed: true, name: "roundId", type: "uint256" },
              { indexed: true, name: "winner", type: "address" },
              { indexed: false, name: "amount", type: "uint256" },
            ],
          },
          fromBlock: fromBlock > deploymentBlock ? fromBlock : deploymentBlock,
          toBlock: "latest",
        });

        const pastWinners = logs.map((log: any) => ({
          roundId: log.args.roundId?.toString() || "0",
          winner: log.args.winner || "",
          amount: log.args.amount ? formatEther(log.args.amount) : "0",
        })).reverse(); // Most recent first

        setWinners(pastWinners.slice(0, 10));
      } catch (error) {
        console.error("Error fetching past winners:", error);
        // Fallback: try with smaller range if error
        try {
          const currentBlock = await publicClient.getBlockNumber();
          const logs = await publicClient.getLogs({
            address: RAFFLE_ADDRESS,
            event: {
              type: "event",
              name: "WinnerPicked",
              inputs: [
                { indexed: true, name: "roundId", type: "uint256" },
                { indexed: true, name: "winner", type: "address" },
                { indexed: false, name: "amount", type: "uint256" },
              ],
            },
            fromBlock: currentBlock - BigInt(500),
            toBlock: "latest",
          });

          const pastWinners = logs.map((log: any) => ({
            roundId: log.args.roundId?.toString() || "0",
            winner: log.args.winner || "",
            amount: log.args.amount ? formatEther(log.args.amount) : "0",
          })).reverse();

          setWinners(pastWinners.slice(0, 10));
        } catch (fallbackError) {
          console.error("Fallback also failed:", fallbackError);
        }
      }
    };

    fetchPastWinners();
  }, [mounted, publicClient]);

  const { data: currentRound, refetch: refetchRound } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getCurrentRound",
    query: {
      enabled: mounted && RAFFLE_ADDRESS !== "0x0000000000000000000000000000000000000000",
      refetchInterval: 5000,
    },
  });

  const { data: entranceFee } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getEntrancyFee",
    query: {
      enabled: mounted && RAFFLE_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });

  const { data: timeUntilDraw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getTimeUntilDraw",
    query: {
      enabled: mounted && RAFFLE_ADDRESS !== "0x0000000000000000000000000000000000000000",
      refetchInterval: 1000,
    },
  });

  useWatchContractEvent({
    address: mounted ? RAFFLE_ADDRESS : undefined,
    abi: RAFFLE_ABI,
    eventName: "WinnerPicked",
    onLogs(logs) {
      const newWinners = logs.map((log: any) => ({
        roundId: log.args.roundId?.toString() || "0",
        winner: log.args.winner || "",
        amount: log.args.amount ? formatEther(log.args.amount) : "0",
      }));
      setWinners((prev) => [...newWinners, ...prev].slice(0, 10));
      refetchRound();
    },
  });

  useWatchContractEvent({
    address: mounted ? RAFFLE_ADDRESS : undefined,
    abi: RAFFLE_ABI,
    eventName: "RaffleEntered",
    onLogs() {
      refetchRound();
    },
  });

  const handleEnterRaffle = () => {
    if (!entranceFee) return;

    writeContract({
      address: RAFFLE_ADDRESS,
      abi: RAFFLE_ABI,
      functionName: "enterRaffle",
      value: entranceFee,
    });
  };

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return "Ready to draw!";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  useEffect(() => {
    if (timeUntilDraw) setTimeLeft(Number(timeUntilDraw));
  }, [timeUntilDraw]);

  const roundData =
    mounted && currentRound
      ? {
          roundId: currentRound[0]?.toString() || "0",
          state: Number(currentRound[1] || 0),
          startTime: Number(currentRound[2] || 0),
          playerCount: currentRound[3]?.toString() || "0",
          prizePool: currentRound[4] ? formatEther(currentRound[4]) : "0",
          winner: currentRound[5] || "0x0000000000000000000000000000000000000000",
        }
      : null;

  const isContractConfigured = RAFFLE_ADDRESS !== "0x0000000000000000000000000000000000000000";

  if (!mounted) {
    return (
      <main className="container-app">
        <div className="glass-card p-8">
          <div className="app-title">🎟️ Raffle</div>
          <p className="muted mt-4">Loading...</p>
        </div>
      </main>
    );
  }

  const canEnter = isConnected && roundData?.state === 0 && !isWriting;

  return (
    <main className="container-app" suppressHydrationWarning>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="app-title">
          🎟️ Raffle <span className="muted text-lg font-medium">Game</span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/" className="btn">
            ← Back
          </Link>
          <span className="text-sm">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
          {isConnected ? (
            <button className="btn btn-danger" onClick={() => disconnect()}>
              Disconnect
            </button>
          ) : (
            <button
              className={`btn btn-primary ${isConnecting ? "opacity-70 cursor-not-allowed" : ""}`}
              onClick={() => connect({ connector: injected() })}
              disabled={isConnecting}
            >
              {isConnecting ? "Connecting..." : "Connect"}
            </button>
          )}
        </div>
      </div>

      {!isContractConfigured ? (
        <section className="glass-card p-8">
          <h3 className="text-xl font-bold mb-2">⚠️ Contract Not Configured</h3>
          <p className="muted">
            Please deploy the Raffle contract and update{" "}
            <code className="px-2 py-1 rounded bg-white/10 border border-white/10">
              NEXT_PUBLIC_RAFFLE_ADDRESS
            </code>
            .
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Current round + Enter */}
          <section className="glass-card p-8">
            <h2 className="text-2xl font-bold mb-6">
              Current Round <span className="muted">#{roundData?.roundId || "..."}</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-card p-4">
                <div className="text-xs muted mb-1">Status</div>
                <div className={`text-lg font-bold ${roundData?.state === 0 ? "text-green-300" : "text-yellow-300"}`}>
                  {roundData ? STATE_NAMES[roundData.state as number] : "..."}
                </div>
              </div>

              <div className="glass-card p-4">
                <div className="text-xs muted mb-1">Players</div>
                <div className="text-lg font-bold">{roundData?.playerCount || "0"}</div>
              </div>

              <div className="glass-card p-4">
                <div className="text-xs muted mb-1">Prize Pool</div>
                <div className="text-lg font-bold" suppressHydrationWarning>
                  {roundData?.prizePool || "0"} ETH
                </div>
              </div>

              <div className="glass-card p-4">
                <div className="text-xs muted mb-1">Draw In</div>
                <div
                  className={`text-base font-bold ${timeLeft <= 0 ? "text-green-300" : "text-white/90"}`}
                  suppressHydrationWarning
                >
                  {formatTime(timeLeft)}
                </div>
              </div>
            </div>

            {/* Buy ticket */}
            <div className="mt-6 glass-card p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">🎟️ Buy Ticket</h3>
                  <div className="muted text-sm">Entrance Fee</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-green-300" suppressHydrationWarning>
                    {entranceFee ? formatEther(entranceFee) : "..."} ETH
                  </div>
                  {isConnected && (
                    <div className="muted text-xs mt-1">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </div>
                  )}
                </div>
              </div>

              {/* Status messages */}
              {!isConnected && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/15 border border-yellow-500/25 text-sm">
                  ⚠️ Please connect your wallet first
                </div>
              )}
              {isConnected && roundData && roundData.state !== 0 && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/15 border border-yellow-500/25 text-sm">
                  ⚠️ Round is currently {STATE_NAMES[roundData.state as number]}. Please wait for the next round.
                </div>
              )}
              {isConnected && roundData && roundData.state === 0 && (
                <div className="mb-4 p-3 rounded-lg bg-green-500/15 border border-green-500/25 text-sm text-green-100">
                  ✅ Round is OPEN! You can buy tickets now.
                </div>
              )}

              <button
                onClick={handleEnterRaffle}
                disabled={!isConnected || isWriting || roundData?.state !== 0}
                className={`btn w-full py-4 text-lg ${
                  canEnter ? "btn-primary" : "opacity-60 cursor-not-allowed"
                }`}
              >
                {!isConnected
                  ? "🔗 Connect Wallet to Enter"
                  : isWriting
                    ? "⏳ Processing Transaction..."
                    : roundData?.state !== 0
                      ? `⏸️ Round is ${STATE_NAMES[roundData?.state || 0]}`
                      : "🎟️ Buy Ticket Now"}
              </button>

              {isConnected && roundData?.state === 0 && (
                <div className="mt-3 muted text-xs text-center" suppressHydrationWarning>
                  Click to purchase a ticket for{" "}
                  {entranceFee ? formatEther(entranceFee) : "0.01"} ETH
                </div>
              )}
            </div>
          </section>

          {/* Right: Winners + How it works */}
          <section className="glass-card p-8">
            <h2 className="text-2xl font-bold mb-4">🏆 Recent Winners</h2>

            {winners.length === 0 ? (
              <p className="muted italic">No winners yet. Be the first!</p>
            ) : (
              <div className="max-h-[320px] overflow-y-auto rounded-xl border border-white/10">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-white/10 backdrop-blur">
                    <tr className="text-left">
                      <th className="px-3 py-3">Round</th>
                      <th className="px-3 py-3">Winner</th>
                      <th className="px-3 py-3">Prize</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winners.map((w, i) => (
                      <tr key={i} className="border-t border-white/10">
                        <td className="px-3 py-3">#{w.roundId}</td>
                        <td className="px-3 py-3 font-mono">
                          {w.winner.slice(0, 6)}...{w.winner.slice(-4)}
                        </td>
                        <td className="px-3 py-3 font-bold">{w.amount} ETH</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-8 glass-card p-6">
              <h3 className="text-xl font-bold mb-3">📖 How It Works</h3>
              <ol className="list-decimal pl-5 leading-7 text-sm text-white/90">
                <li>Connect your wallet and buy a ticket with the entrance fee</li>
                <li>Wait for the draw time (countdown shown on the left)</li>
                <li>Chainlink Keeper automatically triggers the draw when time is up</li>
                <li>Chainlink VRF provides verifiable randomness to pick the winner</li>
                <li>Winner receives the entire prize pool through Treasury</li>
                <li>New round starts automatically</li>
              </ol>

              <div className="mt-4 p-4 rounded-xl bg-blue-500/15 border border-blue-500/25 text-sm text-white/90">
                <strong>🔒 Security:</strong> Randomness is verifiable on-chain via Chainlink VRF.
                Payouts go through Treasury for transparency.
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
