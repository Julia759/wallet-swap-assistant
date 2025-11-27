"use client";

import { FormEvent, useState } from "react";
import { useAccount, useChainId, useContractRead } from "wagmi";
import { erc20Abi, formatUnits, parseUnits } from "viem";

import { TOKENS, TOKENS_BY_SYMBOL, SEPOLIA_CHAIN_ID } from "@/config/tokens";
import { SEPOLIA_SPENDER } from "@/config/spenders";
import { posthog } from "@/app/posthog-provider";

type QuoteResponse = {
  price: string;
  fromAmount: string;
  toAmount: string;
  estimatedGasEth: string;
  estimatedSlippagePercent: number;
};

export function QuoteForm() {
  const chainId = useChainId();
  const { address: walletAddress } = useAccount();

  const [fromSymbol, setFromSymbol] = useState("DAI");
  const [toSymbol, setToSymbol] = useState("WETH");
  const [amount, setAmount] = useState("0.5");

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromToken = TOKENS_BY_SYMBOL[fromSymbol];
  const toToken = TOKENS_BY_SYMBOL[toSymbol];

  const amountInUnits =
    amount && fromToken
      ? (() => {
          try {
            return parseUnits(amount, fromToken.decimals);
          } catch {
            return 0n;
          }
        })()
      : 0n;

  const {
    data: allowanceRaw,
    isLoading: isAllowanceLoading,
    refetch: refetchAllowance,
  } = useContractRead({
    address: (fromToken?.address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      walletAddress && fromToken
        ? [walletAddress as `0x${string}`, SEPOLIA_SPENDER.address]
        : undefined,
    enabled: Boolean(walletAddress && fromToken),
  });

  const allowance = (allowanceRaw ?? 0n) as bigint;
  const hasAmount = amountInUnits > 0n;

  const needsApproval =
    Boolean(walletAddress && fromToken && hasAmount) &&
    allowance < amountInUnits;

  async function handleGetQuote(e: FormEvent) {
    e.preventDefault();

    if (!walletAddress) {
      setError("Connect your wallet first.");
      return;
    }

    if (chainId !== SEPOLIA_CHAIN_ID) {
      setError("Please switch to Sepolia testnet to get a quote.");
      return;
    }

    if (!hasAmount) {
      setError("Enter a valid amount.");
      return;
    }

    setError(null);
    setIsLoadingQuote(true);

    posthog?.capture("quote_requested", {
      chainId,
      tokenA: fromSymbol,
      tokenB: toSymbol,
      amount,
    });

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSymbol,
          toSymbol,
          amount,
        }),
      });

      if (!res.ok) {
        throw new Error(`Quote request failed (${res.status})`);
      }

      const data: QuoteResponse = await res.json();
      setQuote(data);

      console.log("DEBUG: sending quote_received", data); // 👈 help us debug

      posthog?.capture("quote_received", {
        fromToken: fromSymbol,
        toToken: toSymbol,
        amountIn: data.fromAmount,
        amountOut: data.toAmount,
        est_slippage: data.estimatedSlippagePercent,
      });

      await refetchAllowance();
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || "Could not load quote. Please try again in a moment.",
      );
    } finally {
      setIsLoadingQuote(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl bg-slate-900/70 p-6 text-slate-50 shadow-lg">
      <h2 className="mb-4 text-lg font-semibold">Quote</h2>

      <form onSubmit={handleGetQuote} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-sm text-slate-300">From token</label>
          <select
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none"
            value={fromSymbol}
            onChange={(e) => setFromSymbol(e.target.value)}
          >
            {TOKENS.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-slate-300">To token</label>
          <select
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none"
            value={toSymbol}
            onChange={(e) => setToSymbol(e.target.value)}
          >
            {TOKENS.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-slate-300">Amount</label>
          <input
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.5"
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-900/60 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoadingQuote}
          className="flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
        >
          {isLoadingQuote ? "Getting quote…" : "Get quote"}
        </button>
      </form>

      {quote && (
        <div className="mt-4 rounded-xl bg-slate-950/70 px-4 py-3 text-sm leading-relaxed">
          <p>
            1 {fromSymbol} ≈ {quote.price} {toSymbol}
          </p>
          <p>
            You send {quote.fromAmount} {fromSymbol} → you get {quote.toAmount}{" "}
            {toSymbol}
          </p>
          <p>Estimated gas: {quote.estimatedGasEth} ETH (testnet)</p>
          <p>Estimated slippage: {quote.estimatedSlippagePercent}%</p>
        </div>
      )}

      <div className="mt-4 rounded-xl bg-slate-950/40 px-4 py-3 text-sm">
        <p className="mb-1 font-medium">Step 2 · Allowance check</p>
        {!walletAddress && <p>Connect your wallet to check allowance.</p>}

        {walletAddress && !fromToken && (
          <p>Select a “From” token to check allowance.</p>
        )}

        {walletAddress && fromToken && (
          <>
            <p className="text-xs text-slate-300">
              We check how much{" "}
              <span className="font-semibold">{fromToken.symbol}</span> you’ve
              already allowed{" "}
              <span className="font-mono">{SEPOLIA_SPENDER.address}</span>{" "}
              ({SEPOLIA_SPENDER.name}) to spend.
            </p>

            <p className="mt-2">
              Current allowance:{" "}
              {isAllowanceLoading
                ? "loading…"
                : `${formatUnits(allowance, fromToken.decimals)} ${
                    fromToken.symbol
                  }`}
            </p>

            {hasAmount && !isAllowanceLoading && needsApproval && (
              <p className="mt-2 text-amber-300">
                Your allowance is lower than {amount} {fromToken.symbol}. In the
                next step we’ll add an Approve button so you can set a safe
                spending limit.
              </p>
            )}

            {hasAmount && !isAllowanceLoading && !needsApproval && (
              <p className="mt-2 text-emerald-300">
                Your allowance is already high enough for this swap. (No new
                approval needed.)
              </p>
            )}

            <button
              type="button"
              onClick={() => refetchAllowance()}
              className="mt-3 text-xs underline underline-offset-2"
            >
              Refresh allowance
            </button>
          </>
        )}
      </div>
    </div>
  );
}

