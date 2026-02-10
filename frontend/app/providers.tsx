"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const queryClient = new QueryClient();

const hardhatRpc =
  process.env.NEXT_PUBLIC_HARDHAT_RPC_URL ?? "http://127.0.0.1:8545";

const sepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL; // optional

const config = createConfig({
  chains: [hardhat, sepolia],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http(hardhatRpc),
    [sepolia.id]: sepoliaRpc ? http(sepoliaRpc) : http(),
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
