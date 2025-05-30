'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, lightTheme, Theme } from '@rainbow-me/rainbowkit';

// Import correct config from the existing wagmi.ts
import { config } from './wagmi';

// Custom buzzMint theme using the light theme as base
const buzzMintTheme: Theme = {
  ...lightTheme(),
  colors: {
    ...lightTheme().colors,
    // Primary accent colors
    accentColor: '#FF6B6B',
    accentColorForeground: '#FFFFFF',

    // Connect button styling
    connectButtonBackground: '#FF6B6B',
    connectButtonBackgroundError: '#DC3545',
    connectButtonInnerBackground: '#F8F9FA',
    connectButtonText: '#FFFFFF',
    connectButtonTextError: '#FFFFFF',

    // Modal styling
    modalBackground: '#FFFFFF',
    modalBorder: '#E9ECEF',
    modalText: '#2C3E50',
    modalTextDim: '#6C757D',
    modalTextSecondary: '#ADB5BD',
    modalBackdrop: 'rgba(44, 62, 80, 0.4)',

    // General borders and backgrounds
    generalBorder: '#E9ECEF',
    generalBorderDim: '#F8F9FA',
    menuItemBackground: '#F8F9FA',

    // Action buttons
    actionButtonBorder: '#E9ECEF',
    actionButtonBorderMobile: '#E9ECEF',
    actionButtonSecondaryBackground: '#F8F9FA',

    // Profile and account modal
    profileAction: '#F8F9FA',
    profileActionHover: '#E9ECEF',
    profileForeground: '#F8F9FA',

    // Selection and interaction states
    selectedOptionBorder: '#FF6B6B',

    // Close button
    closeButton: '#6C757D',
    closeButtonBackground: '#F8F9FA',

    // Download cards
    downloadBottomCardBackground: '#FFFFFF',
    downloadTopCardBackground: '#F8F9FA',

    // Status indicators
    connectionIndicator: '#4ECDC4',
    error: '#DC3545',
    standby: '#ADB5BD',
  },
  fonts: {
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  radii: {
    actionButton: '8px',
    connectButton: '12px',
    menuButton: '8px',
    modal: '20px',
    modalMobile: '16px',
  },
  shadows: {
    connectButton: '0 2px 8px rgba(255, 107, 107, 0.2)',
    dialog: '0 25px 50px rgba(0, 0, 0, 0.15)',
    profileDetailsAction: '0 2px 4px rgba(0, 0, 0, 0.05)',
    selectedOption: '0 4px 12px rgba(0, 0, 0, 0.05)',
    selectedWallet: '0 4px 8px rgba(255, 107, 107, 0.1)',
    walletLogo: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },
  blurs: {
    modalOverlay: 'blur(8px)',
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
