// app/api/quote/route.ts
//
// This API fetches real swap quotes from 0x Aggregator API
// Docs: https://0x.org/docs/api

import { NextRequest, NextResponse } from "next/server";
import { parseUnits } from "viem";

// Use Edge runtime for faster cold starts
export const runtime = "edge";

// Sepolia token addresses
const SEPOLIA_TOKENS: Record<string, { address: string; decimals: number }> = {
  DAI: { address: "0x68194a729C2450ad26072b3D33ADaCbcef39D574", decimals: 18 },
  WETH: { address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", decimals: 18 },
  USDC: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 },
};

// 0x API endpoint for Sepolia
const ZEROX_API_URL = "https://sepolia.api.0x.org";

type QuoteBody = {
  fromSymbol?: string;
  toSymbol?: string;
  amount?: string;
  walletAddress?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as QuoteBody;
  const { fromSymbol, toSymbol, amount, walletAddress } = body;

  // Validate inputs
  if (!fromSymbol || !toSymbol || typeof amount !== "string") {
    return NextResponse.json(
      { error: "MISSING_PARAMS", message: "fromSymbol, toSymbol and amount are required." },
      { status: 400 }
    );
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return NextResponse.json(
      { error: "INVALID_AMOUNT", message: "Amount must be a positive number." },
      { status: 400 }
    );
  }

  const fromToken = SEPOLIA_TOKENS[fromSymbol];
  const toToken = SEPOLIA_TOKENS[toSymbol];

  if (!fromToken || !toToken) {
    return NextResponse.json(
      { error: "UNKNOWN_TOKEN", message: `Unknown token: ${fromSymbol} or ${toSymbol}` },
      { status: 400 }
    );
  }

  // Convert amount to smallest unit (wei)
  const sellAmount = parseUnits(amount, fromToken.decimals).toString();

  // Get 0x API key from environment
  const apiKey = process.env.ZEROx_API_KEY;

  console.log("API Key present:", !!apiKey, "Key prefix:", apiKey?.substring(0, 8));

  if (!apiKey) {
    // Fallback to mock data if no API key
    console.warn("No ZEROx_API_KEY found, using mock data");
    return NextResponse.json(buildMockQuote(fromSymbol, toSymbol, numericAmount, fromToken, toToken, walletAddress));
  }

  try {
    // Build 0x API request URL
    const params = new URLSearchParams({
      sellToken: fromToken.address,
      buyToken: toToken.address,
      sellAmount: sellAmount,
      ...(walletAddress && { takerAddress: walletAddress }),
    });

    const url = `${ZEROX_API_URL}/swap/v1/quote?${params}`;
    
    console.log("Fetching 0x quote:", url);

    const response = await fetch(url, {
      headers: {
        "0x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("0x API error:", response.status, JSON.stringify(errorData));
      
      // If 0x fails, fallback to mock
      console.warn("0x quote unavailable (status " + response.status + "), using mock data. Error:", errorData.reason || errorData.message || "unknown");
      return NextResponse.json(buildMockQuote(fromSymbol, toSymbol, numericAmount, fromToken, toToken, walletAddress));
    }
    
    console.log("0x API success!");

    const data = await response.json();

    // Transform 0x response to our format
    const quote = {
      // Display data
      price: data.price,
      fromAmount: amount,
      toAmount: (Number(data.buyAmount) / Math.pow(10, toToken.decimals)).toFixed(6),
      estimatedGasEth: (Number(data.estimatedGas) * Number(data.gasPrice) / 1e18).toFixed(6),
      estimatedSlippagePercent: Number(data.estimatedPriceImpact) || 0.5,
      
      // Swap execution data from 0x
      swapData: {
        to: data.to as `0x${string}`,
        data: data.data as `0x${string}`,
        value: data.value || "0",
      },
      
      // Token info
      fromTokenAddress: fromToken.address,
      toTokenAddress: toToken.address,
      amountInWei: sellAmount,
      minAmountOut: data.buyAmount,
      
      // 0x specific
      allowanceTarget: data.allowanceTarget, // Contract to approve (might differ from `to`)
      sources: data.sources, // Which DEXes are used
    };

    return NextResponse.json(quote);

  } catch (error) {
    console.error("Quote error:", error);
    
    // Fallback to mock on any error
    return NextResponse.json(buildMockQuote(fromSymbol, toSymbol, numericAmount, fromToken, toToken, walletAddress));
  }
}

// Fallback mock quote when 0x is unavailable
function buildMockQuote(
  fromSymbol: string,
  toSymbol: string,
  amount: number,
  fromToken: { address: string; decimals: number },
  toToken: { address: string; decimals: number },
  walletAddress?: string
) {
  // Calculate mock price
  let price = 1;
  if (fromSymbol === "WETH" && toSymbol === "DAI") price = 2000;
  else if (fromSymbol === "DAI" && toSymbol === "WETH") price = 0.0005;
  else if (fromSymbol === "USDC" && toSymbol === "WETH") price = 0.0005;
  else if (fromSymbol === "WETH" && toSymbol === "USDC") price = 2000;
  else if (fromSymbol === "DAI" && toSymbol === "USDC") price = 1;
  else if (fromSymbol === "USDC" && toSymbol === "DAI") price = 1;

  const toAmount = amount * price;
  const sellAmount = parseUnits(amount.toString(), fromToken.decimals);

  return {
    price: price.toFixed(6),
    fromAmount: amount.toString(),
    toAmount: toAmount.toFixed(6),
    estimatedGasEth: "0.0002",
    estimatedSlippagePercent: 0.5,
    
    // Mock swap data - will fail on-chain but shows the flow
    swapData: {
      to: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      data: "0x" as `0x${string}`,
      value: "0",
    },
    
    fromTokenAddress: fromToken.address,
    toTokenAddress: toToken.address,
    amountInWei: sellAmount.toString(),
    minAmountOut: parseUnits(toAmount.toFixed(toToken.decimals), toToken.decimals).toString(),
    
    // Flag that this is mock data
    isMock: true,
  };
}
