// src/config/spenders.ts

export type SpenderConfig = {
  name: string;
  address: `0x${string}`;
};

export const SEPOLIA_SPENDER: SpenderConfig = {
  name: "Swap Router (0x-style stub)",
  address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
};


