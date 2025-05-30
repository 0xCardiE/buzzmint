# BuzzMint Collection Workflow

## Overview

BuzzMint now supports a streamlined workflow for creating NFT collections and minting NFTs. Each storage collection (stamp ID) can have its own NFT collection, allowing users to organize their NFTs by storage collections.

## Workflow Steps

### 1. File Upload

- User selects a file and uploads it to a storage collection
- File is uploaded to Swarm network and gets a reference hash
- Data URI is constructed as: `https://bzz.link/bzz/{reference}`

### 2. Collection Check

- System checks if an NFT collection already exists for this stamp ID
- Uses `BuzzMintCollectionFactory.hasContract(stampId)` to check

### 3A. First Upload (New Collection)

If no collection exists:

- User is prompted with collection creation form
- User provides:
  - Collection Name (e.g., "My AI Art Collection")
  - Collection Symbol (e.g., "MYART")
- User can also choose "Use Default Names" for auto-generated names
- System calls `createContractAndMint(stampId, fileName, dataURI, name, symbol)`
- This creates the NFT collection contract AND mints the first NFT

### 3B. Subsequent Uploads (Existing Collection)

If collection exists:

- System automatically mints NFT to existing collection
- Calls `mintNFT(stampId, fileName, dataURI, "", "")`
- No user input required for collection details

## Smart Contract Architecture

### Factory Contract: `BuzzMintCollectionFactory`

- **Address**: `0xEEF13Ef9eD9cDD169701eeF3cd832df298dD1bB4` (Gnosis Chain)
- **Purpose**: Manages creation and minting for all collections

#### Key Mappings:

- `stampIdToContract`: Maps stamp ID → NFT contract address
- `stampIdToOwner`: Maps stamp ID → owner address
- `userStampIds`: Maps user → array of their stamp IDs

#### Key Functions:

- `hasContract(stampId)`: Check if collection exists
- `createContractAndMint(...)`: Create collection + mint first NFT
- `mintNFT(...)`: Mint NFT to existing collection
- `getUserStampIds(user)`: Get all collections for a user

### Collection Contract: `BuzzMintCollection`

- **Purpose**: Individual NFT collection (ERC721A)
- **Features**: On-chain metadata, file name storage, reference tracking

## Data Flow

```
1. Upload File → Swarm Network
   ↓
2. Get Reference Hash
   ↓
3. Check Collection Exists?
   ├─ No → Show Collection Form → Create Collection + Mint NFT
   └─ Yes → Mint NFT to Existing Collection
```

## URI Structure

- **Storage URI**: `https://bzz.link/bzz/{reference}`
- **Metadata**: On-chain JSON with file name, description, and attributes
- **Collection ID**: Stamp ID is included as metadata attribute

## Benefits

1. **Organized Collections**: Each storage collection has its own NFT collection
2. **Seamless Experience**: First upload creates collection, subsequent uploads auto-mint
3. **Flexible Naming**: Users can customize collection names or use defaults
4. **Gas Efficient**: Uses ERC721A for batch minting capabilities
5. **Decentralized Storage**: Files stored on Swarm, metadata on-chain

## Example Usage

### First Upload to Storage Collection "abc123..."

1. Upload `artwork1.jpg` → Reference: `def456...`
2. Prompted for collection details:
   - Name: "My Digital Art"
   - Symbol: "MYART"
3. Creates NFT collection + mints Token #1

### Second Upload to Same Storage Collection

1. Upload `artwork2.jpg` → Reference: `ghi789...`
2. Automatically mints Token #2 to "My Digital Art" collection
3. No user input required

## Technical Implementation

- **Frontend**: React components with form handling
- **Blockchain**: Gnosis Chain for low gas costs
- **Storage**: Swarm network for decentralized file storage
- **Metadata**: Base64-encoded JSON stored on-chain
- **Standards**: ERC721A for NFT collections
