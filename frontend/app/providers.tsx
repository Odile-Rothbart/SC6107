"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const queryClient = new QueryClient();

// ✅ 必须提供：Sepolia RPC（你队友给你的那个）
const sepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

if (!sepoliaRpc) {
  throw new Error(
    "Missing NEXT_PUBLIC_SEPOLIA_RPC_URL in .env.local (Sepolia chainId=11155111)."
  );
}

const config = createConfig({
  // ✅ 只启用 Sepolia，避免默认/回退连到 hardhat 8545
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(sepoliaRpc),
  },
  ssr: true,
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}