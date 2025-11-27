// app/api/quote/route.ts

import { NextRequest, NextResponse } from "next/server";

type QuoteBody = {
  fromSymbol?: string;
  toSymbol?: string;
  amount?: string;
};

function buildQuote(fromSymbol: string, toSymbol: string, amount: number) {
  let price = 1;

  if (fromSymbol === "WETH" && toSymbol === "DAI") {
    price = 2000;
  } else if (fromSymbol === "DAI" && toSymbol === "WETH") {
    price = 1 / 2000;
  }

  const toAmount = amount * price;

  return {
    price: price.toFixed(6),
    fromAmount: amount.toString(),
    toAmount: toAmount.toFixed(6),
    estimatedGasEth: "0.0002",
    estimatedSlippagePercent: 0.5,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as QuoteBody;
  const { fromSymbol, toSymbol, amount } = body;

  if (!fromSymbol || !toSymbol || typeof amount !== "string") {
    return NextResponse.json(
      {
        error: "MISSING_PARAMS",
        message: "fromSymbol, toSymbol and amount are required.",
      },
      { status: 400 },
    );
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return NextResponse.json(
      {
        error: "INVALID_AMOUNT",
        message: "Amount must be a positive number.",
      },
      { status: 400 },
    );
  }

  const quote = buildQuote(fromSymbol, toSymbol, numericAmount);
  return NextResponse.json(quote);
}


