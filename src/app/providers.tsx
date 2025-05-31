'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';

// Import correct config from the existing wagmi.ts
import { config } from './wagmi';

// Minimal buzzMint theme - keeping defaults for text visibility
const buzzMintTheme = {
  ...lightTheme(),
  colors: {
    ...lightTheme().colors,
    // Only override the main accent color, keep everything else default
    accentColor: '#4ECDC4',
    accentColorForeground: '#FFFFFF',
  },
};

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={buzzMintTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
