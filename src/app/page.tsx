'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import SwapComponent from './components/SwapComponent';

export default function BuzzMintPage() {
  return (
    <div className="buzz-theme">
      {/* Header */}
      <header className="buzz-header">
        <button
          className="buzz-logo-container"
          onClick={() => (window.location.href = '/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
            margin: '0',
            outline: 'none',
            textAlign: 'left',
          }}
          type="button"
          aria-label="Go to home page"
        >
          <div className="buzz-logo-icon">B</div>
          <span className="buzz-logo-text">buzzMint</span>
          <div className="buzz-ai-small">+AI</div>
        </button>
        <div className="buzz-header-buttons">
          <ConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="buzz-container">
        {/* Main App Component */}
        <SwapComponent />

        {/* Footer */}
        <footer
          className="buzz-text-center buzz-mt-4"
          style={{ padding: '2rem 0', borderTop: '1px solid var(--buzz-border)' }}
        >
          <p style={{ color: 'var(--buzz-text-secondary)' }}>
            © 2024 buzzMint - AI-Powered NFT Creation Platform
          </p>
        </footer>
      </main>
    </div>
  );
}
