"use client";

import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWatchContractEvent } from "wagmi";
import { injected } from "wagmi/connectors";
import { formatEther, parseEther } from "viem";
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

  const [winners, setWinners] = useState<WinnerEvent[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Read current round data (only when mounted)
  const { data: currentRound, refetch: refetchRound } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getCurrentRound",
    query: {
      enabled: mounted && RAFFLE_ADDRESS !== "0x0000000000000000000000000000000000000000",
      refetchInterval: 5000, // Refresh every 5 seconds
    },
  });

  // Read entrance fee (only when mounted)
  const { data: entranceFee } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getEntrancyFee",
    query: {
      enabled: mounted && RAFFLE_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });

  // Read time until draw (only when mounted)
  const { data: timeUntilDraw, refetch: refetchTime } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getTimeUntilDraw",
    query: {
      enabled: mounted && RAFFLE_ADDRESS !== "0x0000000000000000000000000000000000000000",
      refetchInterval: 1000, // Refresh every second for countdown
    },
  });

  // Watch for winner picked events (only on client)
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
      setWinners((prev) => [...newWinners, ...prev].slice(0, 10)); // Keep last 10
      refetchRound(); // Refresh round data when winner is picked
    },
  });

  // Watch for raffle entered events (to refresh UI) - only on client
  useWatchContractEvent({
    address: mounted ? RAFFLE_ADDRESS : undefined,
    abi: RAFFLE_ABI,
    eventName: "RaffleEntered",
    onLogs() {
      refetchRound(); // Refresh when someone enters
    },
  });

  // Handle entering the raffle
  const handleEnterRaffle = () => {
    if (!entranceFee) return;
    
    writeContract({
      address: RAFFLE_ADDRESS,
      abi: RAFFLE_ABI,
      functionName: "enterRaffle",
      value: entranceFee,
    });
  };

  // Format time countdown
  const formatTime = (seconds: number) => {
    if (seconds <= 0) return "Ready to draw!";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Update countdown
  useEffect(() => {
    if (timeUntilDraw) {
      setTimeLeft(Number(timeUntilDraw));
    }
  }, [timeUntilDraw]);

  // Parse round data (only when mounted to avoid hydration issues)
  const roundData = mounted && currentRound ? {
    roundId: currentRound[0]?.toString() || "0",
    state: Number(currentRound[1] || 0),
    startTime: Number(currentRound[2] || 0),
    playerCount: currentRound[3]?.toString() || "0",
    prizePool: currentRound[4] ? formatEther(currentRound[4]) : "0",
    winner: currentRound[5] || "0x0000000000000000000000000000000000000000",
  } : null;

  // Debug: log current round data and connection status
  useEffect(() => {
    console.log("🔍 Debug Info:", {
      mounted,
      isConnected,
      address,
      contractAddress: RAFFLE_ADDRESS,
      currentRound: currentRound ? "loaded" : "null",
      roundData: roundData ? "parsed" : "null",
    });
    
    if (roundData) {
      console.log("🎲 Round Data:", {
        roundId: roundData.roundId,
        state: roundData.state,
        stateName: STATE_NAMES[roundData.state],
        playerCount: roundData.playerCount,
        prizePool: roundData.prizePool,
      });
    }
  }, [mounted, isConnected, address, currentRound, roundData]);

  const isContractConfigured = RAFFLE_ADDRESS !== "0x0000000000000000000000000000000000000000";

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto" }}>
        <h1>🎟️ Raffle Game</h1>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto" }} suppressHydrationWarning>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>🎟️ Raffle Game</h1>
        <Link href="/">
          <button style={{ padding: "8px 16px", cursor: "pointer" }}>← Back to Home</button>
        </Link>
      </div>

      {/* Wallet Connection */}
      <section style={{ marginBottom: 16, padding: 16, border: "1px solid #ddd", borderRadius: 8, backgroundColor: "#f9f9f9" }}>
        <h3 style={{ marginTop: 0 }}>Wallet</h3>
        {!isConnected ? (
          <button 
            onClick={() => connect({ connector: injected() })} 
            disabled={isConnecting}
            style={{ padding: "10px 20px", cursor: isConnecting ? "not-allowed" : "pointer" }}
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        ) : (
          <div>
            <div style={{ marginBottom: 8, fontSize: 14 }}>
              Connected: <code>{address?.slice(0, 6)}...{address?.slice(-4)}</code>
            </div>
            <button onClick={() => disconnect()} style={{ padding: "8px 16px", cursor: "pointer" }}>
              Disconnect
            </button>
          </div>
        )}
      </section>

      {!isContractConfigured ? (
        <section style={{ padding: 16, border: "1px solid #ffa500", borderRadius: 8, backgroundColor: "#fff3cd" }}>
          <h3>⚠️ Contract Not Configured</h3>
          <p>Please deploy the Raffle contract and update the <code>RAFFLE_ADDRESS</code> in this file.</p>
        </section>
      ) : (
        <>
          {/* Current Round Info */}
          <section style={{ marginBottom: 16, padding: 16, border: "2px solid #4CAF50", borderRadius: 8 }}>
            <h2 style={{ marginTop: 0 }}>Current Round #{roundData?.roundId || "..."}</h2>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div style={{ padding: 12, backgroundColor: "#f0f0f0", borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Status</div>
                <div style={{ fontSize: 20, fontWeight: "bold", color: roundData?.state === 0 ? "#4CAF50" : "#FF9800" }}>
                  {roundData ? STATE_NAMES[roundData.state] : "..."}
                </div>
              </div>

              <div style={{ padding: 12, backgroundColor: "#f0f0f0", borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Players</div>
                <div style={{ fontSize: 20, fontWeight: "bold" }}>{roundData?.playerCount || "0"}</div>
              </div>

              <div style={{ padding: 12, backgroundColor: "#f0f0f0", borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Prize Pool</div>
                <div style={{ fontSize: 20, fontWeight: "bold" }} suppressHydrationWarning>
                  {roundData?.prizePool || "0"} ETH
                </div>
              </div>

              <div style={{ padding: 12, backgroundColor: "#f0f0f0", borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Draw In</div>
                <div 
                  style={{ fontSize: 16, fontWeight: "bold", color: timeLeft <= 0 ? "#4CAF50" : "#333" }}
                  suppressHydrationWarning
                >
                  {formatTime(timeLeft)}
                </div>
              </div>
            </div>

            {/* Enter Raffle Button */}
            <div style={{ marginTop: 20, padding: 20, backgroundColor: "#f9f9f9", borderRadius: 8, border: "2px solid #4CAF50" }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>🎟️ Buy Ticket</h3>
              <div style={{ marginBottom: 12, fontSize: 14, color: "#666" }}>
                Entrance Fee: <strong style={{ color: "#4CAF50", fontSize: 18 }} suppressHydrationWarning>
                  {entranceFee ? formatEther(entranceFee) : "..."} ETH
                </strong>
              </div>
              
              {/* Status Messages */}
              {!isConnected && (
                <div style={{ marginBottom: 12, padding: 8, backgroundColor: "#fff3cd", borderRadius: 4, fontSize: 13 }}>
                  ⚠️ Please connect your wallet first
                </div>
              )}
              {isConnected && roundData && roundData.state !== 0 && (
                <div style={{ marginBottom: 12, padding: 8, backgroundColor: "#fff3cd", borderRadius: 4, fontSize: 13 }}>
                  ⚠️ Round is currently {STATE_NAMES[roundData.state]}. Please wait for the next round.
                </div>
              )}
              {isConnected && roundData && roundData.state === 0 && (
                <div style={{ marginBottom: 12, padding: 8, backgroundColor: "#d4edda", borderRadius: 4, fontSize: 13, color: "#155724" }}>
                  ✅ Round is OPEN! You can buy tickets now.
                </div>
              )}
              
              <button
                onClick={handleEnterRaffle}
                disabled={!isConnected || isWriting || roundData?.state !== 0}
                style={{
                  padding: "16px 32px",
                  fontSize: 18,
                  fontWeight: "bold",
                  backgroundColor: isConnected && roundData?.state === 0 && !isWriting ? "#4CAF50" : "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: isConnected && roundData?.state === 0 && !isWriting ? "pointer" : "not-allowed",
                  width: "100%",
                  maxWidth: 400,
                  boxShadow: isConnected && roundData?.state === 0 && !isWriting ? "0 4px 6px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.3s",
                }}
                onMouseEnter={(e) => {
                  if (isConnected && roundData?.state === 0 && !isWriting) {
                    e.currentTarget.style.backgroundColor = "#45a049";
                    e.currentTarget.style.transform = "scale(1.02)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (isConnected && roundData?.state === 0 && !isWriting) {
                    e.currentTarget.style.backgroundColor = "#4CAF50";
                    e.currentTarget.style.transform = "scale(1)";
                  }
                }}
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
                <div style={{ marginTop: 12, fontSize: 12, color: "#666", textAlign: "center" }} suppressHydrationWarning>
                  Click the button above to purchase a ticket for {entranceFee ? formatEther(entranceFee) : "0.01"} ETH
                </div>
              )}
            </div>
          </section>

          {/* Recent Winners */}
          <section style={{ marginBottom: 16, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
            <h2 style={{ marginTop: 0 }}>🏆 Recent Winners</h2>
            {winners.length === 0 ? (
              <p style={{ color: "#666", fontStyle: "italic" }}>No winners yet. Be the first!</p>
            ) : (
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                      <th style={{ padding: "8px 4px" }}>Round</th>
                      <th style={{ padding: "8px 4px" }}>Winner</th>
                      <th style={{ padding: "8px 4px" }}>Prize</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winners.map((w, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "8px 4px" }}>#{w.roundId}</td>
                        <td style={{ padding: "8px 4px", fontFamily: "monospace", fontSize: 13 }}>
                          {w.winner.slice(0, 6)}...{w.winner.slice(-4)}
                        </td>
                        <td style={{ padding: "8px 4px", fontWeight: "bold" }}>{w.amount} ETH</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* How It Works */}
          <section style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, backgroundColor: "#f9f9f9" }}>
            <h3 style={{ marginTop: 0 }}>📖 How It Works</h3>
            <ol style={{ paddingLeft: 20, lineHeight: 1.8 }}>
              <li>Connect your wallet and buy a ticket with the entrance fee</li>
              <li>Wait for the draw time (countdown shown above)</li>
              <li>Chainlink Keeper automatically triggers the draw when time is up</li>
              <li>Chainlink VRF provides verifiable random number to pick winner</li>
              <li>Winner receives the entire prize pool through Treasury</li>
              <li>New round starts automatically!</li>
            </ol>
            <div style={{ marginTop: 12, padding: 12, backgroundColor: "#e3f2fd", borderRadius: 6, fontSize: 14 }}>
              <strong>🔒 Security:</strong> All randomness is verifiable on-chain via Chainlink VRF. 
              All payouts go through the platform Treasury for transparency.
            </div>
          </section>
        </>
      )}
    </main>
  );
}
