"use client";

import { useEffect, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useNetwork } from "wagmi";
import { QuoteForm } from "../components/QuoteForm";
import { posthog } from "./posthog-provider";

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();

  const isOnSepolia = chain?.name === "Sepolia";
  const canQuote = isConnected && isOnSepolia;

  const hasTrackedConnect = useRef(false);

  useEffect(() => {
    if (!isConnected || !address || !chain) return;
    if (!posthog || hasTrackedConnect.current) return;

    posthog.identify(address);

    posthog.capture("connect", {
      chainId: chain.id,
    });

    hasTrackedConnect.current = true;
  }, [isConnected, address, chain]);

  return (
    <div className="w-full max-w-md space-y-6 border border-slate-800 rounded-xl p-6 bg-slate-900/60 shadow-lg">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Wallet Swap Assistant</h1>
        <p className="text-sm text-slate-300">
          v0.1 · Testnet-only · Connect your wallet on Sepolia to start.
        </p>
      </header>

      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-300">Wallet</span>
        <ConnectButton chainStatus="icon" showBalance={false} />
      </div>

      <div className="rounded-lg bg-slate-950/60 p-4 space-y-2 text-sm">
        <p className="font-medium text-slate-100">Status</p>

        {!isConnected && (
          <p className="text-slate-300">
            Not connected. Click &ldquo;Connect Wallet&rdquo; to continue.
          </p>
        )}

        {isConnected && (
          <>
            <p className="text-slate-300 break-all">
              <span className="font-medium text-slate-100">Address:</span>{" "}
              {address}
            </p>
            <p className="text-slate-300">
              <span className="font-medium text-slate-100">Network:</span>{" "}
              {chain?.name ?? "Unknown"}
            </p>

            {!isOnSepolia && (
              <p className="text-amber-300 mt-2">
                You&apos;re on <span className="font-semibold">{chain?.name}</span>.{" "}
                Switch to <span className="font-semibold">Sepolia</span> in your wallet
                to use the assistant. We only support testnet for v0.1.
              </p>
            )}

            {isOnSepolia && (
              <p className="text-emerald-300 mt-2">
                ✅ Connected on Sepolia. You can request a test quote below.
              </p>
            )}
          </>
        )}
      </div>

      {/* Quote form */}
      {canQuote ? (
        <QuoteForm />
      ) : (
        <div className="rounded-xl bg-slate-900/40 p-4 text-sm text-slate-300">
          Connect your wallet on Sepolia to unlock quotes.
        </div>
      )}
    </div>
  );
}
