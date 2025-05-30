# BuzzMint Smart Contracts

This directory contains the smart contracts for the BuzzMint AI-powered NFT platform.

## Contracts

### BuzzMintCollectionFactory.sol

The factory contract responsible for:

- Deploying individual NFT collection contracts per stamp ID (collection ID)
- Managing stamp ID to contract mappings
- Supporting multiple collections per user
- Minting NFTs through the factory pattern
- Preventing duplicate minting of the same data URI

### BuzzMintCollection.sol

The individual NFT collection contract that:

- Extends ERC721A for gas-efficient batch minting
- Stores on-chain metadata with BuzzMint branding
- Tracks minted references to prevent duplicates
- Stores the stamp ID (collection ID) for identification
- Generates Base64-encoded JSON metadata with collection ID

### StampsRegistry.sol

Registry contract for managing Swarm postage stamps (storage collections).

## Architecture

### Collection ID = Stamp ID

Each NFT collection is tied to a **stamp ID** (from storage collections):

- **Stamp ID**: Unique identifier from storage system
- **One Collection per Stamp ID**: Each stamp ID gets its own NFT collection contract
- **Multiple Collections per User**: Users can have multiple stamp IDs, thus multiple collections
- **Auto-Creation**: First NFT mint for a stamp ID automatically creates the collection

### Flow

1. **User uploads file** → Gets stamp ID from storage
2. **First NFT mint** → Factory creates new collection contract for that stamp ID
3. **Subsequent mints** → Factory uses existing collection contract for that stamp ID

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
    "abc123def456...",        // stampId (collection ID from storage)
    "My First NFT.png",       // fileName
    "bzz://abc123...",        // dataURI from Swarm
    "My BuzzMint Collection", // collection name (optional)
    "BUZZ"                    // collection symbol (optional)
);
```

### Minting Additional NFTs (Auto-creates collection if needed)

```solidity
// Mint NFT - creates collection if doesn't exist, or uses existing one
uint256 tokenId = factory.mintNFT(
    "abc123def456...",     // stampId (collection ID from storage)
    "My Second NFT.png",   // fileName
    "bzz://def456...",     // dataURI from Swarm
    "My Collection",       // collection name (used only if creating new)
    "BUZZ"                 // collection symbol (used only if creating new)
);
```

### Checking if Collection Exists

```solidity
(bool exists, address contractAddress) = factory.hasContract("abc123def456...");
```

### Checking if Data Already Minted

```solidity
bool alreadyMinted = factory.isReferenceMinted("abc123def456...", "bzz://abc123...");
```

### Getting User's Collections

```solidity
string[] memory userStampIds = factory.getUserStampIds(userAddress);
```

## Key Features

- **Stamp ID Based**: Collections are identified by stamp IDs from storage system
- **Multiple Collections**: Users can have multiple collections (one per stamp ID)
- **Auto-Creation**: Collections are created automatically on first NFT mint
- **Gas Efficient**: Uses ERC721A for optimized batch minting
- **Duplicate Prevention**: Prevents minting the same data URI twice per collection
- **On-chain Metadata**: Stores metadata directly on-chain with Base64 encoding
- **Collection Tracking**: Each NFT includes its collection ID in metadata
- **BuzzMint Branding**: Metadata includes BuzzMint platform attribution
- **Swarm Integration**: Designed to work with Swarm storage URIs

## Security

- Factory-only minting prevents unauthorized NFT creation
- Stamp ID ownership verification for existing collections
- Owner controls for emergency functions
- Reference tracking prevents duplicate minting per collection
- Proper access controls on all functions
