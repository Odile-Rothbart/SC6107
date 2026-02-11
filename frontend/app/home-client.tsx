"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { injected } from "wagmi/connectors";
import { formatUnits, isAddress, type Address } from "viem";

const TREASURY_ADDRESS_RAW = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

const TREASURY_ADDRESS: Address | undefined = isAddress(TREASURY_ADDRESS_RAW)
  ? (TREASURY_ADDRESS_RAW as Address)
  : undefined;

export default function HomeClient() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const { data: bal, isLoading } = useBalance({
    address: TREASURY_ADDRESS,
    query: { enabled: isConnected && !!TREASURY_ADDRESS },
  });

  return (
    <main className="container-app">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="app-title">
           On-Chain Verifiable Random Game Platform
        </div>

        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <div className="muted text-sm hidden sm:block">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
              <button className="btn btn-danger" onClick={() => disconnect()}>
                Disconnect
              </button>
            </>
          ) : (
            <button
              className={`btn btn-primary ${
                isPending ? "opacity-70 cursor-not-allowed" : ""
              }`}
              onClick={() => connect({ connector: injected() })}
              disabled={isPending}
            >
              {isPending ? "Connecting..." : "Connect"}
            </button>
          )}
        </div>
      </div>

      {/* Two-panel layout like the screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left: Overview / Wallet */}
        <section className="glass-card p-8 h-full">
          <h2 className="text-2xl font-bold mb-4">👛 Wallet</h2>

          {!isConnected ? (
            <div className="muted text-sm">
              Connect your wallet to view balances and enter games.
            </div>
          ) : (
            <div className="glass-card p-5 mt-4">
              <div className="text-xs muted mb-1">Connected Address</div>
              <div className="font-mono break-all">{address}</div>
            </div>
          )}

          <div className="mt-8">
            <h3 className="text-xl font-bold mb-3">🎮 Quick Start</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/raffle" className="btn btn-primary w-full py-4 text-base">
                Go to Raffle
              </Link>
              <Link href="/DiceGame" className="btn w-full py-4 text-base">
                Go to DiceGame
              </Link>
            </div>

            
          </div>
        </section>

        {/* Right: Treasury */}
        <section className="glass-card p-8 h-full">
          <h2 className="text-2xl font-bold mb-4">🏦 Treasury</h2>

          <div className="glass-card p-5">
            <div className="text-xs muted mb-1">Treasury Address</div>
            <div className="font-mono break-all">
              {TREASURY_ADDRESS ?? "TBD (.env.local)"}
            </div>

            <div className="mt-4">
              <div className="text-xs muted mb-1">Treasury Balance</div>

              {!TREASURY_ADDRESS ? (
                <div className="muted text-sm">
                  TBD — set{" "}
                  <code className="px-2 py-1 rounded bg-white/10 border border-white/10">
                    NEXT_PUBLIC_TREASURY_ADDRESS
                  </code>{" "}
                  in <code className="px-2 py-1 rounded bg-white/10 border border-white/10">frontend/.env.local</code>
                </div>
              ) : isLoading ? (
                <div className="muted text-sm">Loading...</div>
              ) : bal ? (
                <div className="text-2xl font-extrabold text-green-300">
                  {formatUnits(bal.value, bal.decimals)} {bal.symbol}
                </div>
              ) : (
                <div className="muted text-sm">0</div>
              )}
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-blue-500/15 border border-blue-500/25 text-sm text-white/90">
            <strong>🔒 Note:</strong> Game randomness is verifiable on-chain via Chainlink VRF.
            Payouts go through Treasury for transparency.
          </div>
        </section>
      </div>
    </main>
  );
}
