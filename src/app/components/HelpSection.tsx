import React from 'react';
import styles from './css/HelpSection.module.css';

interface HelpSectionProps {
  nodeAddress: string;
  openAiApiKey: string;
  onOpenAiKeyChange: (newKey: string) => void;
}

const HelpSection: React.FC<HelpSectionProps> = ({
  nodeAddress,
  openAiApiKey,
  onOpenAiKeyChange,
}) => {
  return (
    <div className={styles.helpContainer}>
      <div className={styles.helpContent}>
        <div className={styles.helpHeader}>
          <h2>Settings</h2>
        </div>

        {/* OpenAI API Key Settings */}
        <div className={styles.settingsSection}>
          <h3>OpenAI API Configuration</h3>
          <div className={styles.settingItem}>
            <label className={styles.settingLabel}>
              OpenAI API Key
              <span className={styles.optional}>(Optional)</span>
              {openAiApiKey && <span className={styles.statusIndicator}>✓ Configured</span>}
            </label>
            <input
              type="password"
              value={openAiApiKey}
              onChange={e => onOpenAiKeyChange(e.target.value)}
              placeholder="sk-..."
              className={styles.settingInput}
            />
            <p className={styles.settingDescription}>
              Enter your OpenAI API key to enable AI-powered features. Your key is stored locally on
              your device and never sent to our servers.
              {openAiApiKey && (
                <>
                  <br />
                  <strong>Status:</strong> API key is configured and ready to use.
                </>
              )}
            </p>
          </div>
        </div>

        <div className={styles.helpHeader}>
          <h2>How to use BuzzMint?</h2>
        </div>

        <ol>
          <li>
            <h3>Connect Your Wallet</h3>
            <p>
              Connect your Web3 wallet (MetaMask, WalletConnect, etc.) to get started. Make sure you
              have some tokens on supported chains to pay for storage and NFT minting.
            </p>
          </li>
          <li>
            <h3>Buy Storage</h3>
            <p>
              Purchase decentralized storage on the Swarm network. Choose your storage size (Pixel
              Art ~100MB, Standard ~600MB, or HQ ~2GB) and duration (1 year, 5 years, or 10 years).
            </p>
          </li>
          <li>
            <h3>Upload & Mint NFTs</h3>
            <p>
              Upload your images, videos, or any files to create NFT collections. Your first upload
              creates a new collection, and subsequent uploads mint additional NFTs to the same
              collection.
            </p>
          </li>
          <li>
            <h3>View Your Collections</h3>
            <p>
              Check your minted NFTs in the "Minted" tab and manage your storage collections in the
              "Collections" tab. All your NFTs are stored permanently on the decentralized Swarm
              network.
            </p>
          </li>
        </ol>

        <h2>Frequently Asked Questions</h2>
        <div className={styles.faqSection}>
          <div className={styles.faqItem}>
            <h3>What is BuzzMint?</h3>
            <p>
              BuzzMint is an AI-powered NFT minter that combines decentralized storage with NFT
              creation. Upload any file to the Swarm network and automatically mint it as an NFT on
              Gnosis blockchain.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>Which blockchains are supported?</h3>
            <p>
              BuzzMint supports Ethereum, Gnosis, Arbitrum, Optimism, Base, Polygon, Rootstock,
              Abstract, and Berachain. You can pay for storage with tokens from any of these chains.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>How long does it take for my storage to become available?</h3>
            <p>
              After purchasing storage, it typically takes 2-3 minutes for your storage collections
              to become usable. The app will automatically notify you once your storage is ready for
              use.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>What happens if my upload fails?</h3>
            <p>
              If an upload fails, the system will automatically retry several times. If it continues
              to fail, your collections and tokens remain safe, and you can try the upload again.
              The most common cause is network connectivity issues.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>Can I mint multiple NFTs to the same collection?</h3>
            <p>
              Yes! Your first upload to a storage collection creates a new NFT collection. All
              subsequent uploads to the same storage collection will mint additional NFTs to that
              same collection.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>What file types are supported?</h3>
            <p>
              BuzzMint supports all file types including images (PNG, JPG, GIF), videos (MP4, MOV),
              audio files, documents, and archives (ZIP, TAR, GZIP). Files are stored permanently on
              Swarm.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpSection;
