# BuzzMint Smart Contract Deployment Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Create a `.env` file in the project root:

```env
WALLET_SECRET=your_private_key_here
PRIVATE_RPC_MAINNET=https://gnosis-rpc.publicnode.com
MAINNET_ETHERSCAN_KEY=your_gnosisscan_api_key_here
```

### 3. Deploy to Gnosis Chain

```bash
# Deploy only the BuzzMint Factory
npm run deploy:gnosis

# Or deploy all contracts
npm run deploy:all:gnosis
```

## What Gets Deployed

### BuzzMintCollectionFactory

- **Purpose**: Factory contract for creating individual NFT collections
- **Gas Cost**: ~2-3M gas
- **Features**:
  - Creates individual NFT collection contracts per user
  - Manages user-to-contract mappings
  - Prevents duplicate minting of same data URI
  - Handles both collection creation and NFT minting

### BuzzMintCollection (deployed per user)

- **Purpose**: Individual ERC721A NFT collection contract
- **Gas Cost**: ~1.5-2M gas per deployment
- **Features**:
  - ERC721A for gas-efficient minting
  - On-chain metadata with BuzzMint branding
  - Base64-encoded JSON metadata
  - Reference tracking to prevent duplicates

## Post-Deployment

### 1. Verify Contracts

```bash
npm run verify:gnosis
```

### 2. Get Contract Addresses

After deployment, addresses are saved in:

```
deployments/gnosis/BuzzMintCollectionFactory.json
```

### 3. Update Frontend Configuration

Update your frontend constants with the deployed factory address:

```typescript
export const BUZZMINT_FACTORY_ADDRESS = '0x...'; // From deployment
```

## Usage Examples

### Create Collection and Mint First NFT

```typescript
const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

const tx = await factory.createContractAndMint(
  'My AI Art.png', // fileName
  'bzz://abc123...', // dataURI from Swarm
  'My BuzzMint Collection', // collection name (optional)
  'BUZZ' // collection symbol (optional)
);

const receipt = await tx.wait();
// Extract collection address and token ID from events
```

### Mint Additional NFTs

```typescript
const tx = await factory.mintNFT(
  'Another AI Art.png', // fileName
  'bzz://def456...' // dataURI from Swarm
);
```

### Check if Already Minted

```typescript
const alreadyMinted = await factory.isReferenceMinted(userAddress, 'bzz://abc123...');
```

## Troubleshooting

### Common Issues

1. **"Contract already exists"**: User already has a collection deployed
2. **"This data has already been minted"**: Trying to mint duplicate data URI
3. **"Only factory or owner can mint"**: Calling mint directly on collection instead of factory

### Gas Estimation

- **Factory Deployment**: ~2-3M gas
- **Collection Creation**: ~1.5-2M gas
- **NFT Minting**: ~100-200k gas per NFT

### Network Configuration

Ensure your wallet is connected to Gnosis Chain:

- **Chain ID**: 100
- **RPC URL**: https://gnosis-rpc.publicnode.com
- **Explorer**: https://gnosisscan.io

## Security Notes

- Factory contract is ownable for emergency functions
- Individual collections are owned by the user who created them
- Only factory can mint NFTs (prevents unauthorized minting)
- Reference tracking prevents duplicate minting
- All contracts are verified on GnosisScan for transparency
