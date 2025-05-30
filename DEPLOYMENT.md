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

### 1. Verify Contracts on Both Explorers

BuzzMint automatically verifies contracts on both Gnosis Blockscout and GnosisScan during deployment. You can also verify manually:

#### Option 1: Verify on Both Explorers (Recommended)

```bash
npm run verify:factory
```

#### Option 2: Verify on Specific Explorer

```bash
# Blockscout only
npm run verify:factory:blockscout

# GnosisScan only
npm run verify:factory:gnosisscan
```

#### Option 3: Use Custom Verification Script

```bash
npm run verify:contracts
```

#### Option 4: Manual Verification with Hardhat

```bash
# Verify on Blockscout
npx hardhat verify --network gnosis 0xEEF13Ef9eD9cDD169701eeF3cd832df298dD1bB4

# Verify on GnosisScan
npx hardhat verify --network gnosisscan 0xEEF13Ef9eD9cDD169701eeF3cd832df298dD1bB4

# Force verification if already verified
npx hardhat verify --network gnosis --force 0xEEF13Ef9eD9cDD169701eeF3cd832df298dD1bB4
```

#### Verify Individual Collection Contracts

When users create NFT collections, you can verify them on both explorers:

```bash
# Blockscout
npx hardhat verify --network gnosis COLLECTION_ADDRESS "stampId" "Collection Name" "SYMBOL" "0xEEF13Ef9eD9cDD169701eeF3cd832df298dD1bB4"

# GnosisScan
npx hardhat verify --network gnosisscan COLLECTION_ADDRESS "stampId" "Collection Name" "SYMBOL" "0xEEF13Ef9eD9cDD169701eeF3cd832df298dD1bB4"
```

**Notes**:

- Blockscout doesn't require a real API key - our configuration uses a placeholder value
- GnosisScan requires `MAINNET_ETHERSCAN_KEY` in your `.env` file
- Deployment script automatically attempts verification on both explorers

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
  'abc123def456...', // stampId (collection ID from storage)
  'My AI Art.png', // fileName
  'bzz://abc123...', // dataURI from Swarm
  'My BuzzMint Collection', // collection name (optional)
  'BUZZ' // collection symbol (optional)
);

const receipt = await tx.wait();
// Extract collection address and token ID from events
```

### Mint Additional NFTs (Auto-creates collection if needed)

```typescript
const tx = await factory.mintNFT(
  'abc123def456...', // stampId (collection ID from storage)
  'Another AI Art.png', // fileName
  'bzz://def456...', // dataURI from Swarm
  'My Collection', // collection name (used only if creating new)
  'BUZZ' // collection symbol (used only if creating new)
);
```

### Check if Collection Exists

```typescript
const [exists, contractAddress] = await factory.hasContract('abc123def456...');
```

### Check if Already Minted

```typescript
const alreadyMinted = await factory.isReferenceMinted('abc123def456...', 'bzz://abc123...');
```

### Get User's Collections

```typescript
const userStampIds = await factory.getUserStampIds(userAddress);
// Returns array of stamp IDs (collection IDs) owned by user
```

## Troubleshooting

### Common Issues

1. **"Contract already exists"**: User already has a collection deployed
2. **"This data has already been minted"**: Trying to mint duplicate data URI
3. **"Only factory or owner can mint"**: Calling mint directly on collection instead of factory

### Blockscout Verification Issues

1. **"Contract already verified"**: Use `--force` flag to re-verify
2. **"Verification failed"**: Check constructor arguments match exactly
3. **"API key error"**: Blockscout doesn't need real API key, any string works
4. **"Network not supported"**: Ensure customChains configuration is correct

### Verification Tips

- Blockscout ignores constructor arguments for verification, but Hardhat still requires them
- Use `--force` flag if contract was automatically verified but you want to add sources
- Individual collection contracts need 4 constructor arguments: `stampId`, `name`, `symbol`, `factoryAddress`
- Factory contract has no constructor arguments

### Gas Estimation

- **Factory Deployment**: ~2-3M gas
- **Collection Creation**: ~1.5-2M gas
- **NFT Minting**: ~100-200k gas per NFT

### Network Configuration

Ensure your wallet is connected to Gnosis Chain:

- **Chain ID**: 100
- **RPC URL**: https://gnosis-rpc.publicnode.com
- **Explorer**: https://gnosis.blockscout.com

## Security Notes

- Factory contract is ownable for emergency functions
- Individual collections are owned by the user who created them
- Only factory can mint NFTs (prevents unauthorized minting)
- Reference tracking prevents duplicate minting
- All contracts are verified on Gnosis Blockscout for transparency
