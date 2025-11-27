"use client";

import "@rainbow-me/rainbowkit/styles.css";

import React, { ReactNode } from "react";

import {
  WagmiConfig,
  configureChains,
  createClient,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { publicProvider } from "wagmi/providers/public";
import {
  RainbowKitProvider,
  getDefaultWallets,
} from "@rainbow-me/rainbowkit";

const { chains, provider } = configureChains(
  [sepolia],
  [publicProvider()]
);

const { connectors } = getDefaultWallets({
  appName: "Wallet Swap Assistant",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains,
});

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider chains={chains}>
        {children as any}
      </RainbowKitProvider>
    </WagmiConfig>
  );
}

