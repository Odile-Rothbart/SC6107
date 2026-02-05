"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { injected } from "wagmi/connectors";
import { formatUnits } from "viem";

const TREASURY_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export default function HomeClient() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const { data: bal, isLoading } = useBalance({
    address: TREASURY_ADDRESS,
    query: { enabled: TREASURY_ADDRESS !== "0x0000000000000000000000000000000000000000" },
  });

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">On-Chain Verifiable Random Game Platform</h1>

      <section className="border rounded-xl p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-2">Wallet</h2>
        {!isConnected ? (
          <button
            className="px-4 py-2 rounded-md border"
            onClick={() => connect({ connector: injected() })}
            disabled={isPending}
          >
            {isPending ? "Connecting..." : "Connect Wallet"}
          </button>
        ) : (
          <>
            <div className="mb-3 break-all">Connected: {address}</div>
            <button className="px-4 py-2 rounded-md border" onClick={() => disconnect()}>
              Disconnect
            </button>
          </>
        )}
      </section>

      <section className="border rounded-xl p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-2">Treasury</h2>
        <div className="break-all">Address: {TREASURY_ADDRESS}</div>
        <div className="mt-2">
          Balance:{" "}
          {TREASURY_ADDRESS === "0x0000000000000000000000000000000000000000"
            ? "TBD (set deployed address)"
            : isLoading
            ? "Loading..."
            : bal
            ? `${formatUnits(bal.value, bal.decimals)} ${bal.symbol}`
            : "0"}
        </div>
      </section>

      <section className="flex gap-3">
        <Link href="/Game1">
          <button className="px-4 py-2 rounded-md border">Go to Game1</button>
        </Link>
        <Link href="/Game2">
          <button className="px-4 py-2 rounded-md border">Go to Game2</button>
        </Link>
      </section>
    </main>
  );
}
