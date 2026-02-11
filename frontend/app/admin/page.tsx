"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
} from "wagmi";

// ⚠️ Replace with your deployed RandomnessProvider address (from hardhat deploy logs)
const RANDOMNESS_PROVIDER_ADDRESS = (process.env.NEXT_PUBLIC_RANDOMNESS_PROVIDER_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

// Minimal ABI
const ABI = [
  {
    inputs: [],
    name: "requestRandomWords",
    outputs: [{ internalType: "uint256", name: "requestId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "requestId", type: "uint256" },
      { indexed: true, internalType: "address", name: "requester", type: "address" },
    ],
    name: "RequestSent",
    type: "event",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function AdminPanel() {
  const { isConnected } = useAccount();
  const [logs, setLogs] = useState<string[]>([]);
  const { writeContract, isPending, isSuccess } = useWriteContract();

  // Read owner
  const { data: owner } = useReadContract({
    address: RANDOMNESS_PROVIDER_ADDRESS,
    abi: ABI,
    functionName: "owner",
  });

  // Watch event logs
  useWatchContractEvent({
    address: RANDOMNESS_PROVIDER_ADDRESS,
    abi: ABI,
    eventName: "RequestSent",
    onLogs(newLogs) {
      newLogs.forEach((log: any) => {
        const requestId = log.args?.requestId?.toString?.() ?? "";
        const requester = log.args?.requester ?? "";
        const message = `[${new Date().toLocaleTimeString()}] Request ID: ${requestId} | By: ${requester}`;
        setLogs((prev) => [message, ...prev]);
      });
    },
  });

  const handleRequest = () => {
    writeContract({
      address: RANDOMNESS_PROVIDER_ADDRESS,
      abi: ABI,
      functionName: "requestRandomWords",
    });
  };

  const isConfigured =
    RANDOMNESS_PROVIDER_ADDRESS !== "0x0000000000000000000000000000000000000000";

  return (
    <main className="container-app">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="app-title">
          🛠️ Admin <span className="muted text-lg font-medium">Randomness Provider</span>
        </div>
      </div>

      {!isConfigured ? (
        <section className="glass-card p-8">
          <h3 className="text-xl font-bold mb-2">⚠️ Contract Not Configured</h3>
          <p className="muted">
            Please set{" "}
            <code className="px-2 py-1 rounded bg-white/10 border border-white/10">
              NEXT_PUBLIC_RANDOMNESS_PROVIDER_ADDRESS
            </code>{" "}
            in <code className="px-2 py-1 rounded bg-white/10 border border-white/10">.env.local</code>.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Left: status + action */}
          <section className="glass-card p-8 h-full">
            <h2 className="text-2xl font-bold mb-6">Status</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-card p-5">
                <div className="text-xs muted mb-1">Contract Address</div>
                <div className="font-mono break-all">{RANDOMNESS_PROVIDER_ADDRESS}</div>
              </div>

              <div className="glass-card p-5">
                <div className="text-xs muted mb-1">Owner / Admin</div>
                <div className="font-mono break-all">{owner ? String(owner) : "Loading..."}</div>
              </div>
            </div>

            <div className="mt-6 glass-card p-6">
              <h3 className="text-xl font-bold mb-2">⚡ Action</h3>
              <p className="muted text-sm mb-4">
                Trigger a randomness request (event{" "}
                <code className="px-2 py-1 rounded bg-white/10 border border-white/10">
                  RequestSent
                </code>{" "}
                will appear on the right).
              </p>

              {!isConnected && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/15 border border-yellow-500/25 text-sm">
                  ⚠️ Please connect your wallet first
                </div>
              )}

              {isSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-green-500/15 border border-green-500/25 text-sm text-green-100">
                  ✅ Request transaction sent!
                </div>
              )}

              <button
                onClick={handleRequest}
                disabled={!isConnected || isPending}
                className={`btn w-full py-4 text-lg ${
                  !isConnected || isPending ? "opacity-60 cursor-not-allowed" : "btn-primary"
                }`}
              >
                {isPending ? "Requesting..." : "⚡ Trigger Randomness Request"}
              </button>
            </div>
          </section>

          {/* Right: logs */}
          <section className="glass-card p-8 h-full">
            <h2 className="text-2xl font-bold mb-4">Live Event Logs</h2>

            <div className="glass-card p-5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-white/90">RequestSent</div>
                <div className="muted text-xs">{logs.length} entries</div>
              </div>

              <div className="h-72 overflow-y-auto rounded-xl border border-white/10 bg-black/35 p-4 font-mono text-sm text-green-200">
                {logs.length === 0 ? (
                  <div className="muted italic">Waiting for events...</div>
                ) : (
                  logs.map((l, i) => <div key={i} className="py-1">{l}</div>)
                )}
              </div>
            </div>

            
          </section>
        </div>
      )}
    </main>
  );
}
