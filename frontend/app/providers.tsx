"use client";

import * as React from 'react';
import { defineChain } from 'viem';

// 1. Define Monad Testnet Chain for reading direct RPC client queries
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monadscan',
      url: 'https://testnet.monadscan.com',
    },
  },
  testnet: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
    </>
  );
}
