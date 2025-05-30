'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import SwapComponent from './components/SwapComponent';

export default function BuzzMintPage() {
  return (
    <div className="buzz-theme">
      {/* Header */}
      <header className="buzz-header">
        <div className="buzz-logo-container">
          <div className="buzz-logo-icon">B</div>
          <span className="buzz-logo-text">buzzMint</span>
          <div className="buzz-ai-badge">
            <div className="buzz-ai-icon">AI</div>
            AI-Powered
          </div>
        </div>
        <div className="buzz-header-buttons">
          <ConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="buzz-container">
        {/* Hero Section */}
        <section className="buzz-text-center buzz-mb-4">
          <h1 className="buzz-page-title buzz-fade-in">Create Stunning NFTs with AI</h1>
          <p className="buzz-subtitle buzz-fade-in">
            buzzMint combines the power of artificial intelligence with blockchain technology to
            help you create, customize, and mint unique NFTs effortlessly. Transform your ideas into
            digital masterpieces.
          </p>

          <div className="buzz-flex buzz-flex-center buzz-gap-4 buzz-mb-4">
            <button className="buzz-button buzz-button-primary">🎨 Start Creating</button>
            <button className="buzz-button buzz-button-mint">⚡ Quick Mint</button>
            <button className="buzz-button buzz-button-secondary">📚 Learn More</button>
          </div>
        </section>

        {/* Features Grid */}
        <section className="buzz-mb-4">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem',
              marginBottom: '3rem',
            }}
          >
            <div className="buzz-card buzz-fade-in">
              <div className="buzz-card-header">
                <h3>🤖 AI Art Generation</h3>
              </div>
              <p>
                Generate unique artwork using advanced AI models. Simply describe your vision and
                watch it come to life.
              </p>
            </div>

            <div className="buzz-card buzz-fade-in">
              <div className="buzz-card-header">
                <h3>⚡ Instant Minting</h3>
              </div>
              <p>
                Mint your NFTs instantly on multiple blockchains with just a few clicks. No
                technical knowledge required.
              </p>
            </div>

            <div className="buzz-card buzz-fade-in">
              <div className="buzz-card-header">
                <h3>🎨 Style Customization</h3>
              </div>
              <p>
                Choose from dozens of artistic styles, or train custom models with your own artistic
                preferences.
              </p>
            </div>
          </div>
        </section>

        {/* Main App Components */}
        <section>
          <div className="buzz-card">
            <div className="buzz-card-header">
              <h2>🚀 NFT Creation Studio</h2>
              <p className="buzz-subtitle" style={{ marginBottom: 0 }}>
                Use our advanced tools to create and mint your NFTs
              </p>
            </div>
            <SwapComponent />
          </div>
        </section>

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
