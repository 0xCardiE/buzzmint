// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./MyNFTCollection.sol";

/**
 * @title MyNFTCollectionFactory
 * @dev Factory contract for deploying and managing MyNFTCollection contracts
 */
contract MyNFTCollectionFactory is Ownable {
    // Mapping from user address to their NFT contract address
    mapping(address => address) public userContracts;
    
    // Default NFT collection name and symbol prefixes
    string private constant NAME_PREFIX = "Data Collection - ";
    string private constant SYMBOL_PREFIX = "DATA-";
    
    // Events
    event ContractCreated(address indexed user, address contractAddress, string name, string symbol);
    event NFTMinted(address indexed user, address contractAddress, uint256 tokenId, string fileName, string dataURI);
    
    /**
     * @dev Constructor to initialize the contract with the deployer as the owner
     */
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Creates a new MyNFTCollection contract for a user
     * @param name The name of the NFT collection
     * @param symbol The symbol of the NFT collection
     * @return The address of the newly created contract
     */
    function createContract(string memory name, string memory symbol) public returns (address) {
        require(userContracts[msg.sender] == address(0), "Contract already exists for this address");
        
        // Create a new MyNFTCollection contract
        MyNFTCollection newContract = new MyNFTCollection(name, symbol, msg.sender);
        address contractAddress = address(newContract);
        
        // Register the contract in the mapping
        userContracts[msg.sender] = contractAddress;
        
        emit ContractCreated(msg.sender, contractAddress, name, symbol);
        
        return contractAddress;
    }
    
    /**
     * @dev Creates a contract with default name/symbol if not provided
     * @param userAddress The address of the user
     * @param name The name of the NFT collection (optional)
     * @param symbol The symbol of the NFT collection (optional)
     * @return The address of the newly created contract
     */
    function _createContractForUser(
        address userAddress,
        string memory name,
        string memory symbol
    ) internal returns (address) {
        // Generate default name and symbol if not provided
        string memory finalName = bytes(name).length > 0 ? 
            name : string(abi.encodePacked(NAME_PREFIX, Strings.toHexString(uint160(userAddress), 20)));
            
        string memory finalSymbol = bytes(symbol).length > 0 ? 
            symbol : string(abi.encodePacked(SYMBOL_PREFIX, Strings.toHexString(uint160(userAddress) & 0xFFFFFF, 6)));
        
        // Create a new MyNFTCollection contract
        MyNFTCollection newContract = new MyNFTCollection(finalName, finalSymbol, userAddress);
        address contractAddress = address(newContract);
        
        // Register the contract in the mapping
        userContracts[userAddress] = contractAddress;
        
        emit ContractCreated(userAddress, contractAddress, finalName, finalSymbol);
        
        return contractAddress;
    }
    
    /**
     * @dev Checks if a reference has already been minted in a user's collection
     * @param user The address of the user
     * @param dataURI The data URI to check
     * @return Whether the reference has been minted
     */
    function isReferenceMinted(address user, string memory dataURI) public view returns (bool) {
        address contractAddress = userContracts[user];
        if (contractAddress == address(0)) {
            return false;
        }
        
        MyNFTCollection userContract = MyNFTCollection(contractAddress);
        return userContract.isReferenceMinted(dataURI);
    }
    
    /**
     * @dev Creates a new contract and mints the first NFT in a single transaction
     * @param fileName The name of the file
     * @param dataURI The URI of the stored data
     * @param name The name of the NFT collection (optional)
     * @param symbol The symbol of the NFT collection (optional)
     * @return The contract address and token ID
     */
    function createContractAndMint(
        string memory fileName,
        string memory dataURI,
        string memory name,
        string memory symbol
    ) public returns (address, uint256) {
        require(userContracts[msg.sender] == address(0), "Contract already exists for this address");
        
        // Create a new contract for the user
        address contractAddress = _createContractForUser(msg.sender, name, symbol);
        
        // Mint the first NFT
        MyNFTCollection userContract = MyNFTCollection(contractAddress);
        uint256 tokenId = userContract.mint(msg.sender, fileName, dataURI);
        
        emit NFTMinted(msg.sender, contractAddress, tokenId, fileName, dataURI);
        
        return (contractAddress, tokenId);
    }
    
    /**
     * @dev Mints a new NFT for a user
     * @param fileName The name of the file
     * @param dataURI The URI of the stored data
     * @return The token ID of the minted NFT
     */
    function mintNFT(string memory fileName, string memory dataURI) public returns (uint256) {
        address contractAddress = userContracts[msg.sender];
        require(contractAddress != address(0), "No contract exists for this address");
        
        // Get the user's NFT contract
        MyNFTCollection userContract = MyNFTCollection(contractAddress);
        
        // Check if this reference has already been minted
        require(!userContract.isReferenceMinted(dataURI), "This data has already been minted as an NFT");
        
        // Mint a new NFT
        uint256 tokenId = userContract.mint(msg.sender, fileName, dataURI);
        
        emit NFTMinted(msg.sender, contractAddress, tokenId, fileName, dataURI);
        
        return tokenId;
    }
    
    /**
     * @dev Checks if a user has a deployed NFT contract
     * @param user The address of the user
     * @return Whether the user has a deployed contract and the contract address
     */
    function hasContract(address user) public view returns (bool, address) {
        address contractAddress = userContracts[user];
        return (contractAddress != address(0), contractAddress);
    }
} 