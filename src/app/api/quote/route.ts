// app/api/quote/route.ts
//
// This API returns a quote with swap calldata.
// In production, you'd call a real aggregator (0x, 1inch, Paraswap).
// For this Sepolia testnet demo, we return mock data structure.

import { NextRequest, NextResponse } from "next/server";
import { parseUnits, encodeFunctionData } from "viem";

// Use Edge runtime for faster cold starts
export const runtime = "edge";

// Sepolia token addresses (from our config)
const SEPOLIA_TOKENS: Record<string, { address: string; decimals: number }> = {
  DAI: { address: "0x68194a729C2450ad26072b3D33ADaCbcef39D574", decimals: 18 },
  WETH: { address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", decimals: 18 },
  USDC: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 },
};

// Mock swap router on Sepolia (in production, this comes from aggregator)
// This is a placeholder - real aggregators return the actual DEX router address
const MOCK_SWAP_ROUTER = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD"; // Uniswap Universal Router on Sepolia

type QuoteBody = {
  fromSymbol?: string;
  toSymbol?: string;
  amount?: string;
  walletAddress?: string;
};

function buildQuote(
  fromSymbol: string,
  toSymbol: string,
  amount: number,
  walletAddress?: string
) {
  // Calculate mock price
  let price = 1;
  if (fromSymbol === "WETH" && toSymbol === "DAI") {
    price = 2000;
  } else if (fromSymbol === "DAI" && toSymbol === "WETH") {
    price = 1 / 2000;
  } else if (fromSymbol === "USDC" && toSymbol === "WETH") {
    price = 1 / 2000;
  } else if (fromSymbol === "WETH" && toSymbol === "USDC") {
    price = 2000;
  } else if (fromSymbol === "DAI" && toSymbol === "USDC") {
    price = 1;
  } else if (fromSymbol === "USDC" && toSymbol === "DAI") {
    price = 1;
  }

  const toAmount = amount * price;
  const fromToken = SEPOLIA_TOKENS[fromSymbol];
  const toToken = SEPOLIA_TOKENS[toSymbol];

  if (!fromToken || !toToken) {
    throw new Error(`Unknown token: ${fromSymbol} or ${toSymbol}`);
  }

  // Calculate amounts in wei/smallest unit
  const amountInWei = parseUnits(amount.toString(), fromToken.decimals);
  const minAmountOut = parseUnits(
    (toAmount * 0.995).toFixed(toToken.decimals), // 0.5% slippage
    toToken.decimals
  );

  // Build swap calldata
  // In production, this comes from the aggregator API response
  // This is a simplified example showing the data structure
  const swapData = {
    // The contract to call (DEX router or aggregator contract)
    to: MOCK_SWAP_ROUTER as `0x${string}`,
    
    // The calldata to send (encoded function call)
    // In production, aggregator returns this pre-built
    data: buildMockSwapCalldata(
      fromToken.address,
      toToken.address,
      amountInWei,
      minAmountOut,
      walletAddress || "0x0000000000000000000000000000000000000000"
    ),
    
    // Value to send (only non-zero if swapping native ETH)
    value: fromSymbol === "ETH" ? amountInWei.toString() : "0",
  };

  return {
    // Quote display data
    price: price.toFixed(6),
    fromAmount: amount.toString(),
    toAmount: toAmount.toFixed(6),
    estimatedGasEth: "0.0002",
    estimatedSlippagePercent: 0.5,
    
    // Swap execution data
    swapData,
    
    // Token addresses for reference
    fromTokenAddress: fromToken.address,
    toTokenAddress: toToken.address,
    amountInWei: amountInWei.toString(),
    minAmountOut: minAmountOut.toString(),
  };
}

// Build mock swap calldata
// In production, the aggregator API returns this
function buildMockSwapCalldata(
  fromToken: string,
  toToken: string,
  amountIn: bigint,
  minAmountOut: bigint,
  recipient: string
): `0x${string}` {
  // This is a simplified mock - real aggregators return complex calldata
  // that routes through multiple DEXes for best price
  
  // For demo purposes, we encode a basic swap function signature
  // Real aggregators like 0x return ready-to-use calldata
  const mockCalldata = encodeFunctionData({
    abi: [{
      name: "swap",
      type: "function",
      inputs: [
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "amountIn", type: "uint256" },
        { name: "minAmountOut", type: "uint256" },
        { name: "recipient", type: "address" },
      ],
      outputs: [{ name: "amountOut", type: "uint256" }],
    }],
    functionName: "swap",
    args: [
      fromToken as `0x${string}`,
      toToken as `0x${string}`,
      amountIn,
      minAmountOut,
      recipient as `0x${string}`,
    ],
  });

  return mockCalldata;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as QuoteBody;
  const { fromSymbol, toSymbol, amount, walletAddress } = body;

  if (!fromSymbol || !toSymbol || typeof amount !== "string") {
    return NextResponse.json(
      {
        error: "MISSING_PARAMS",
        message: "fromSymbol, toSymbol and amount are required.",
      },
      { status: 400 }
    );
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return NextResponse.json(
      {
        error: "INVALID_AMOUNT",
        message: "Amount must be a positive number.",
      },
      { status: 400 }
    );
  }

  try {
    const quote = buildQuote(fromSymbol, toSymbol, numericAmount, walletAddress);
    return NextResponse.json(quote);
  } catch (error) {
    return NextResponse.json(
      {
        error: "QUOTE_ERROR",
        message: (error as Error).message,
      },
      { status: 400 }
    );
  }
}
