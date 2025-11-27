// app/tokens.ts

export type Token = {
  symbol: string;
  name: string;
  address: `0x${string}`; // placeholder for now
  decimals: number;
};

export const TOKENS: Token[] = [
  {
    symbol: "WETH",
    name: "Wrapped Ether (test)",
    // TODO: replace with real Sepolia WETH address later
    address: "0x0000000000000000000000000000000000000001",
    decimals: 18,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin (test)",
    // TODO: replace with real Sepolia DAI address later
    address: "0x0000000000000000000000000000000000000002",
    decimals: 18,
  },
];



