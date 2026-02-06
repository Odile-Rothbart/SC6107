"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { injected } from "wagmi/connectors";
import { formatUnits, isAddress, type Address } from "viem";

const TREASURY_ADDRESS_RAW = process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? "";
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
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        On-Chain Verifiable Random Game Platform
      </h1>

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
            <div className="mb-3 break-all">
              Connected: {address}
            </div>
            <button
              className="px-4 py-2 rounded-md border"
              onClick={() => disconnect()}
            >
              Disconnect
            </button>
          </>
        )}
      </section>

      <section className="border rounded-xl p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-2">Treasury</h2>
        <div className="break-all">
          Address: {TREASURY_ADDRESS ?? "TBD (.env.local)"}
        </div>

        <div className="mt-2">
          Balance:{" "}
          {!TREASURY_ADDRESS ? (
            <span className="opacity-70">TBD (set NEXT_PUBLIC_TREASURY_ADDRESS in frontend/.env.local)</span>
          ) : isLoading ? (
            "Loading..."
          ) : bal ? (
            `${formatUnits(bal.value, bal.decimals)} ${bal.symbol}`
          ) : (
            "0"
          )}

        </div>
      </section>

      <section className="flex gap-3">
        <Link href="/Game1">
          <button className="px-4 py-2 rounded-md border">
            Go to Game1
          </button>
        </Link>
        <Link href="/Game2">
          <button className="px-4 py-2 rounded-md border">
            Go to Game2
          </button>
        </Link>
      </section>
    </main>
  );
}
