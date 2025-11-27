// src/config/tokens.ts

export type Token = {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
};

export const SEPOLIA_CHAIN_ID = 11155111;

export const TOKENS: Token[] = [
  {
    symbol: "DAI",
    name: "Dai Stablecoin (testnet)",
    address: "0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357",
    decimals: 18,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether (testnet)",
    address: "0x7b79995e5f793a07bc00c21412e50ecae098e7f9",
    decimals: 18,
  },
];

export const TOKENS_BY_SYMBOL: Record<string, Token> = TOKENS.reduce(
  (acc, token) => {
    acc[token.symbol] = token;
    return acc;
  },
  {} as Record<string, Token>,
);


