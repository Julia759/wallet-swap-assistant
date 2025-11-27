"use client";

import { FormEvent, useState, useEffect } from "react";
import {
  useAccount,
  useChainId,
  useContractRead,
  useContractWrite,
  useWaitForTransaction,
  useSendTransaction,
} from "wagmi";
import { erc20Abi, formatUnits, parseUnits, maxUint256 } from "viem";

import { TOKENS, TOKENS_BY_SYMBOL, SEPOLIA_CHAIN_ID } from "@/config/tokens";
import { SEPOLIA_SPENDER } from "@/config/spenders";
import { posthog } from "@/app/posthog-provider";

type SwapData = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
};

type QuoteResponse = {
  price: string;
  fromAmount: string;
  toAmount: string;
  estimatedGasEth: string;
  estimatedSlippagePercent: number;
  // Swap execution data
  swapData?: SwapData;
  fromTokenAddress?: string;
  toTokenAddress?: string;
  amountInWei?: string;
  minAmountOut?: string;
  // 0x specific
  allowanceTarget?: string; // Contract to approve (from 0x)
  sources?: Array<{ name: string; proportion: string }>; // DEX sources used
  isMock?: boolean; // True if using fallback mock data
  mockReason?: string; // Why mock data is being used
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
  const [approvalMode, setApprovalMode] = useState<"exact" | "unlimited">("exact");
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [swapMessage, setSwapMessage] = useState<string | null>(null);

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

  // Use allowanceTarget from quote (0x) or fallback to default spender
  const spenderAddress = (quote?.allowanceTarget || SEPOLIA_SPENDER.address) as `0x${string}`;

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
        ? [walletAddress as `0x${string}`, spenderAddress]
        : undefined,
    enabled: Boolean(walletAddress && fromToken),
  });

  const allowance = (allowanceRaw ?? 0n) as bigint;
  const hasAmount = amountInUnits > 0n;

  const needsApproval =
    Boolean(walletAddress && fromToken && hasAmount) &&
    allowance < amountInUnits;

  // Calculate approval amount based on mode
  const approvalAmount = approvalMode === "unlimited" ? maxUint256 : amountInUnits;

  // Approve contract write
  const {
    data: approveData,
    isLoading: isApproveLoading,
    write: approveWrite,
    error: approveWriteError,
  } = useContractWrite({
    mode: "recklesslyUnprepared",
    address: (fromToken?.address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    abi: erc20Abi,
    functionName: "approve",
    args: [spenderAddress, approvalAmount] as any,
    onError: (err: Error) => {
      const errorMessage = err.message?.slice(0, 150) || "Unknown error";
      setApprovalError(errorMessage);
      posthog?.capture("approve_failed", {
        token: fromSymbol,
        spender: spenderAddress,
        mode: approvalMode,
        amount: amount,
        err_msg: errorMessage,
      });
    },
  } as any);

  // Wait for approve transaction
  const { isLoading: isApproveWaiting, isSuccess: isApproveSuccess } =
    useWaitForTransaction({
      hash: approveData?.hash,
    });

  // Handle successful approval
  useEffect(() => {
    if (isApproveSuccess && approveData?.hash) {
      setApprovalError(null);
      refetchAllowance();
      posthog?.capture("approve_mined", {
        token: fromSymbol,
        spender: spenderAddress,
        mode: approvalMode,
        amount: approvalMode === "unlimited" ? "unlimited" : amount,
        tx_hash: approveData.hash,
      });
    }
  }, [isApproveSuccess, approveData?.hash, fromSymbol, approvalMode, amount, refetchAllowance]);

  const isApprovePending = isApproveLoading || isApproveWaiting;

  // Swap transaction hook
  const {
    data: swapTxData,
    isLoading: isSwapLoading,
    sendTransaction: sendSwapTx,
    error: swapTxError,
  } = useSendTransaction({
    mode: "recklesslyUnprepared",
  } as any);

  // Wait for swap transaction
  const { isLoading: isSwapWaiting, isSuccess: isSwapSuccess } =
    useWaitForTransaction({
      hash: swapTxData?.hash,
    });

  // Handle successful swap
  useEffect(() => {
    if (isSwapSuccess && swapTxData?.hash && quote) {
      posthog?.capture("swap_mined", {
        fromToken: fromSymbol,
        toToken: toSymbol,
        amountIn: quote.fromAmount,
        amountOut: quote.toAmount,
        tx_hash: swapTxData.hash,
      });
      setSwapMessage("✅ Swap successful!");
      // Refresh allowance after swap
      refetchAllowance();
    }
  }, [isSwapSuccess, swapTxData?.hash, quote, fromSymbol, toSymbol, refetchAllowance]);

  // Handle swap error
  useEffect(() => {
    if (swapTxError) {
      const errorMessage = swapTxError.message?.slice(0, 150) || "Unknown error";
      posthog?.capture("swap_failed", {
        fromToken: fromSymbol,
        toToken: toSymbol,
        amountIn: quote?.fromAmount,
        amountOut: quote?.toAmount,
        err_msg: errorMessage,
      });
      setSwapMessage(`❌ Swap failed: ${errorMessage}`);
    }
  }, [swapTxError, fromSymbol, toSymbol, quote]);

  const isSwapPending = isSwapLoading || isSwapWaiting;

  // Handle approve button click
  function handleApprove() {
    if (!walletAddress || !fromToken) return;

    setApprovalError(null);

    posthog?.capture("approve_clicked", {
      token: fromToken.symbol,
      spender: spenderAddress,
      mode: approvalMode,
      amount: amount,
    });

    approveWrite?.();
  }

  // Handle swap button click - sends real transaction!
  function handleSwap() {
    if (!walletAddress || !fromToken || !quote || !quote.swapData) return;

    setSwapMessage(null);

    posthog?.capture("swap_clicked", {
      fromToken: fromSymbol,
      toToken: toSymbol,
      amountIn: quote.fromAmount,
      amountOut: quote.toAmount,
    });

    // Send the actual swap transaction
    sendSwapTx?.({
      recklesslySetUnpreparedRequest: {
        to: quote.swapData.to,
        data: quote.swapData.data,
        value: BigInt(quote.swapData.value),
      },
    } as any);
  }

  // Check if swap is ready
  const canSwap = 
    walletAddress && 
    chainId === SEPOLIA_CHAIN_ID && 
    quote && 
    quote.swapData &&
    !needsApproval &&
    !isSwapPending;

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
          walletAddress, // Include wallet for swap calldata
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
          {quote.isMock && (
            <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-3 mb-3">
              <p className="text-amber-400 text-sm font-medium mb-1">
                ⚠️ Demo Mode (Testnet)
              </p>
              <p className="text-amber-300/70 text-xs">
                Sepolia testnet has limited DEX liquidity. Showing estimated prices for demo purposes.
                {quote.mockReason?.includes("no Route") && " No swap route available for this pair."}
              </p>
            </div>
          )}
          <p>
            1 {fromSymbol} ≈ {quote.price} {toSymbol}
          </p>
          <p>
            You send {quote.fromAmount} {fromSymbol} → you get {quote.toAmount}{" "}
            {toSymbol}
          </p>
          <p>Estimated gas: {quote.estimatedGasEth} ETH (testnet)</p>
          <p>Estimated slippage: {quote.estimatedSlippagePercent}%</p>
          {quote.sources && quote.sources.length > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              DEX: {quote.sources.filter(s => Number(s.proportion) > 0).map(s => s.name).join(", ") || "0x"}
            </p>
          )}
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
              <span className="font-mono text-xs break-all">{spenderAddress}</span>{" "}
              to spend.
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
              <div className="mt-3 space-y-3">
                <p className="text-amber-300">
                  Your allowance is lower than {amount} {fromToken.symbol}.
                  Approve the spender to continue.
                </p>

                {/* Exact / Max selector */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">Approve:</span>
                  <button
                    type="button"
                    onClick={() => setApprovalMode("exact")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      approvalMode === "exact"
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    Exact ({amount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalMode("unlimited")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      approvalMode === "unlimited"
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    Unlimited
                  </button>
                </div>

                <p className="text-xs text-slate-400">
                  💡 Exact is safer. Unlimited is for advanced users.
                </p>

                {/* Approve button */}
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApprovePending || !approveWrite}
                  className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
                >
                  {isApproveLoading
                    ? "Confirm in wallet…"
                    : isApproveWaiting
                    ? "Waiting for confirmation…"
                    : `Approve ${fromToken.symbol}`}
                </button>

                {approvalError && (
                  <p className="text-red-400 text-xs">
                    ❌ Approval failed: {approvalError}
                  </p>
                )}

                {isApproveSuccess && (
                  <p className="text-emerald-300 text-xs">
                    ✅ Approval confirmed! You can now swap.
                  </p>
                )}
              </div>
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

      {/* Step 3: Swap */}
      <div className="mt-4 rounded-xl bg-slate-950/40 px-4 py-3 text-sm">
        <p className="mb-2 font-medium">Step 3 · Swap</p>

        {!quote && (
          <p className="text-slate-400">Get a quote first to enable swap.</p>
        )}

        {quote && (
          <>
            <div className="rounded-lg bg-slate-800/50 p-3 mb-3">
              <p className="text-slate-200">
                You send <span className="font-semibold text-white">{quote.fromAmount} {fromSymbol}</span>
              </p>
              <p className="text-slate-200">
                You get <span className="font-semibold text-emerald-400">{quote.toAmount} {toSymbol}</span>
              </p>
            </div>

            {needsApproval && (
              <p className="text-amber-300 text-xs mb-3">
                ⚠️ Approve {fromSymbol} first before swapping.
              </p>
            )}

            <button
              type="button"
              onClick={handleSwap}
              disabled={!canSwap}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSwapLoading
                ? "Confirm in wallet…"
                : isSwapWaiting
                ? "Swapping…"
                : "Swap"}
            </button>

            {swapMessage && (
              <p className={`mt-2 text-xs text-center ${
                swapMessage.includes("✅") ? "text-emerald-300" : 
                swapMessage.includes("❌") ? "text-red-400" : "text-amber-300"
              }`}>
                {swapMessage}
              </p>
            )}

            {isSwapSuccess && (
              <a
                href={`https://sepolia.etherscan.io/tx/${swapTxData?.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-xs text-blue-400 underline block text-center"
              >
                View on Etherscan ↗
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

