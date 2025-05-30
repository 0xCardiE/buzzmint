# BuzzMint Smart Contracts

This directory contains the smart contracts for the BuzzMint AI-powered NFT platform.

## Contracts

### BuzzMintCollectionFactory.sol

The factory contract responsible for:

- Deploying individual NFT collection contracts for users
- Managing user-to-contract mappings
- Minting NFTs through the factory pattern
- Preventing duplicate minting of the same data URI

### BuzzMintCollection.sol

The individual NFT collection contract that:

- Extends ERC721A for gas-efficient batch minting
- Stores on-chain metadata with BuzzMint branding
- Tracks minted references to prevent duplicates
- Generates Base64-encoded JSON metadata

### StampsRegistry.sol

Registry contract for managing Swarm postage stamps (storage collections).

## Deployment

### Prerequisites

1. Set up environment variables in `.env`:
   ```
   WALLET_SECRET=your_private_key
   PRIVATE_RPC_MAINNET=https://gnosis-rpc.publicnode.com
   MAINNET_ETHERSCAN_KEY=your_gnosisscan_api_key
   ```

### Deploy to Gnosis Chain

1. **Compile contracts:**

   ```bash
   npm run compile
   ```

2. **Deploy BuzzMint Factory only:**

   ```bash
   npm run deploy:gnosis
   ```

3. **Deploy all contracts:**

   ```bash
   npm run deploy:all:gnosis
   ```

4. **Verify contracts (optional):**
   ```bash
   npm run verify:gnosis
   ```

### Local Development

Deploy to local Hardhat network:

```bash
npm run deploy:local
```

## Contract Addresses

After deployment, contract addresses will be saved in `deployments/gnosis/` directory.

## Usage

### Creating a Collection and Minting First NFT

```solidity
// Call the factory to create collection and mint first NFT
(address collectionAddress, uint256 tokenId) = factory.createContractAndMint(
    "My First NFT",           // fileName
    "bzz://abc123...",        // dataURI from Swarm
    "My BuzzMint Collection", // collection name (optional)
    "BUZZ"                    // collection symbol (optional)
);
```

### Minting Additional NFTs

```solidity
// Mint additional NFTs to existing collection
uint256 tokenId = factory.mintNFT(
    "My Second NFT",     // fileName
    "bzz://def456..."    // dataURI from Swarm
);
```

### Checking if Data Already Minted

```solidity
bool alreadyMinted = factory.isReferenceMinted(userAddress, "bzz://abc123...");
```

## Features

- **Gas Efficient**: Uses ERC721A for optimized batch minting
- **Duplicate Prevention**: Prevents minting the same data URI twice
- **On-chain Metadata**: Stores metadata directly on-chain with Base64 encoding
- **Factory Pattern**: One factory deploys individual collections per user
- **BuzzMint Branding**: Metadata includes BuzzMint platform attribution
- **Swarm Integration**: Designed to work with Swarm storage URIs

## Security

- Factory-only minting prevents unauthorized NFT creation
- Owner controls for emergency functions
- Reference tracking prevents duplicate minting
- Proper access controls on all functions
