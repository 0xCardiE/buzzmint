// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./BuzzMintCollection.sol";

/**
 * @title BuzzMintCollectionFactory
 * @dev Factory contract for deploying and managing BuzzMintCollection contracts
 */
contract BuzzMintCollectionFactory is Ownable {
    // Mapping from stamp ID to NFT contract address
    mapping(string => address) public stampIdToContract;
    
    // Mapping from user address to array of their stamp IDs
    mapping(address => string[]) public userStampIds;
    
    // Mapping to check if a stamp ID belongs to a user
    mapping(string => address) public stampIdToOwner;
    
    // Default NFT collection name and symbol prefixes
    string private constant NAME_PREFIX = "BuzzMint Collection - ";
    string private constant SYMBOL_PREFIX = "BUZZ-";
    
    // Events
    event ContractCreated(address indexed user, address contractAddress, string stampId, string name, string symbol);
    event NFTMinted(address indexed user, address contractAddress, string stampId, uint256 tokenId, string fileName, string dataURI);
    
    /**
     * @dev Constructor to initialize the contract with the deployer as the owner
     */
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Creates a new BuzzMintCollection contract for a stamp ID
     * @param stampId The stamp ID (collection ID) from storage
     * @param name The name of the NFT collection
     * @param symbol The symbol of the NFT collection
     * @return The address of the newly created contract
     */
    function createContract(string memory stampId, string memory name, string memory symbol) public returns (address) {
        require(stampIdToContract[stampId] == address(0), "Contract already exists for this stamp ID");
        require(bytes(stampId).length > 0, "Stamp ID cannot be empty");
        
        // Create a new BuzzMintCollection contract
        BuzzMintCollection newContract = new BuzzMintCollection(name, symbol, msg.sender, stampId);
        address contractAddress = address(newContract);
        
        // Register the contract in the mappings
        stampIdToContract[stampId] = contractAddress;
        stampIdToOwner[stampId] = msg.sender;
        userStampIds[msg.sender].push(stampId);
        
        emit ContractCreated(msg.sender, contractAddress, stampId, name, symbol);
        
        return contractAddress;
    }
    
    /**
     * @dev Creates a contract with default name/symbol if not provided
     * @param userAddress The address of the user
     * @param stampId The stamp ID (collection ID) from storage
     * @param name The name of the NFT collection (optional)
     * @param symbol The symbol of the NFT collection (optional)
     * @return The address of the newly created contract
     */
    function _createContractForUser(
        address userAddress,
        string memory stampId,
        string memory name,
        string memory symbol
    ) internal returns (address) {
        // Generate default name and symbol if not provided
        string memory finalName = bytes(name).length > 0 ? 
            name : string(abi.encodePacked(NAME_PREFIX, stampId));
            
        string memory finalSymbol = bytes(symbol).length > 0 ? 
            symbol : string(abi.encodePacked(SYMBOL_PREFIX, Strings.toHexString(uint160(userAddress) & 0xFFFFFF, 6)));
        
        // Create a new BuzzMintCollection contract
        BuzzMintCollection newContract = new BuzzMintCollection(finalName, finalSymbol, userAddress, stampId);
        address contractAddress = address(newContract);
        
        // Register the contract in the mappings
        stampIdToContract[stampId] = contractAddress;
        stampIdToOwner[stampId] = userAddress;
        userStampIds[userAddress].push(stampId);
        
        emit ContractCreated(userAddress, contractAddress, stampId, finalName, finalSymbol);
        
        return contractAddress;
    }
    
    /**
     * @dev Checks if a reference has already been minted in a stamp's collection
     * @param stampId The stamp ID (collection ID)
     * @param dataURI The data URI to check
     * @return Whether the reference has been minted
     */
    function isReferenceMinted(string memory stampId, string memory dataURI) public view returns (bool) {
        address contractAddress = stampIdToContract[stampId];
        if (contractAddress == address(0)) {
            return false;
        }
        
        BuzzMintCollection userContract = BuzzMintCollection(contractAddress);
        return userContract.isReferenceMinted(dataURI);
    }
    
    /**
     * @dev Creates a new contract and mints the first NFT in a single transaction
     * @param stampId The stamp ID (collection ID) from storage
     * @param fileName The name of the file
     * @param dataURI The URI of the stored data
     * @param name The name of the NFT collection (optional)
     * @param symbol The symbol of the NFT collection (optional)
     * @return The contract address and token ID
     */
    function createContractAndMint(
        string memory stampId,
        string memory fileName,
        string memory dataURI,
        string memory name,
        string memory symbol
    ) public returns (address, uint256) {
        require(stampIdToContract[stampId] == address(0), "Contract already exists for this stamp ID");
        require(bytes(stampId).length > 0, "Stamp ID cannot be empty");
        
        // Create a new contract for the stamp ID
        address contractAddress = _createContractForUser(msg.sender, stampId, name, symbol);
        
        // Mint the first NFT
        BuzzMintCollection userContract = BuzzMintCollection(contractAddress);
        uint256 tokenId = userContract.mint(msg.sender, fileName, dataURI);
        
        emit NFTMinted(msg.sender, contractAddress, stampId, tokenId, fileName, dataURI);
        
        return (contractAddress, tokenId);
    }
    
    /**
     * @dev Mints a new NFT for a stamp ID (creates collection if doesn't exist)
     * @param stampId The stamp ID (collection ID) from storage
     * @param fileName The name of the file
     * @param dataURI The URI of the stored data
     * @param name The name of the NFT collection (optional, used only if creating new)
     * @param symbol The symbol of the NFT collection (optional, used only if creating new)
     * @return The token ID of the minted NFT
     */
    function mintNFT(
        string memory stampId,
        string memory fileName,
        string memory dataURI,
        string memory name,
        string memory symbol
    ) public returns (uint256) {
        require(bytes(stampId).length > 0, "Stamp ID cannot be empty");
        
        address contractAddress = stampIdToContract[stampId];
        
        // If contract doesn't exist, create it first
        if (contractAddress == address(0)) {
            contractAddress = _createContractForUser(msg.sender, stampId, name, symbol);
        } else {
            // Verify the caller owns this stamp ID
            require(stampIdToOwner[stampId] == msg.sender, "You don't own this stamp ID");
        }
        
        // Get the user's NFT contract
        BuzzMintCollection userContract = BuzzMintCollection(contractAddress);
        
        // Check if this reference has already been minted
        require(!userContract.isReferenceMinted(dataURI), "This data has already been minted as an NFT");
        
        // Mint a new NFT
        uint256 tokenId = userContract.mint(msg.sender, fileName, dataURI);
        
        emit NFTMinted(msg.sender, contractAddress, stampId, tokenId, fileName, dataURI);
        
        return tokenId;
    }
    
    /**
     * @dev Checks if a stamp ID has a deployed NFT contract
     * @param stampId The stamp ID to check
     * @return Whether the stamp ID has a deployed contract and the contract address
     */
    function hasContract(string memory stampId) public view returns (bool, address) {
        address contractAddress = stampIdToContract[stampId];
        return (contractAddress != address(0), contractAddress);
    }
    
    /**
     * @dev Gets all stamp IDs for a user
     * @param user The address of the user
     * @return Array of stamp IDs owned by the user
     */
    function getUserStampIds(address user) public view returns (string[] memory) {
        return userStampIds[user];
    }
    
    /**
     * @dev Gets the owner of a stamp ID
     * @param stampId The stamp ID to check
     * @return The address of the owner
     */
    function getStampIdOwner(string memory stampId) public view returns (address) {
        return stampIdToOwner[stampId];
    }
    
    /**
     * @dev Gets the contract address for a stamp ID
     * @param stampId The stamp ID to check
     * @return The contract address (address(0) if doesn't exist)
     */
    function getContractAddress(string memory stampId) public view returns (address) {
        return stampIdToContract[stampId];
    }
} 