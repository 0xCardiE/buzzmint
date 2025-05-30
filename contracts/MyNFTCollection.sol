// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title MyNFTCollection
 * @dev ERC721A NFT contract for minting data NFTs with on-chain metadata
 */
contract MyNFTCollection is ERC721A, Ownable {
    using Strings for uint256;
    
    // Mapping from token ID to data URI
    mapping(uint256 => string) private _dataURIs;
    
    // Mapping from token ID to file name
    mapping(uint256 => string) private _fileNames;

    // Mapping to track references that have been minted
    mapping(string => bool) private _mintedReferences;
    
    // Factory address that's allowed to mint NFTs
    address public factoryAddress;
    
    // Event emitted when a new NFT is minted
    event DataNFTMinted(address indexed to, uint256 tokenId, string fileName, string dataURI);
    
    /**
     * @dev Constructor
     * @param name The name of the NFT collection
     * @param symbol The symbol of the NFT collection
     * @param initialOwner The initial owner of the contract
     */
    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC721A(name, symbol) Ownable(initialOwner) {
        factoryAddress = msg.sender;  // Set factory as the allowed minter
    }
    
    /**
     * @dev Override the _startTokenId function to start the token ID from 1 instead of 0
     */
    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }
    
    /**
     * @dev Exposes the _nextTokenId from ERC721A for enumeration
     * @return The next token ID to be minted
     */
    function getNextTokenId() public view returns (uint256) {
        return _nextTokenId();
    }
    
    /**
     * @dev Checks if a reference has been minted
     * @param referenceURI The reference to check
     * @return True if the reference has been minted
     */
    function isReferenceMinted(string memory referenceURI) public view returns (bool) {
        return _mintedReferences[referenceURI];
    }
    
    /**
     * @dev Mints a new NFT with data URI
     * @param to The recipient of the NFT
     * @param _fileName The name of the file
     * @param _dataURI The URI of the stored data
     * @return The token ID of the minted NFT
     */
    function mint(
        address to,
        string memory _fileName,
        string memory _dataURI
    ) public returns (uint256) {
        require(msg.sender == factoryAddress || msg.sender == owner(), "Only factory or owner can mint");
        
        // Mark this reference as minted to prevent duplicates
        _mintedReferences[_dataURI] = true;
        
        uint256 tokenId = _nextTokenId();
        _mint(to, 1);
        
        _dataURIs[tokenId] = _dataURI;
        _fileNames[tokenId] = _fileName;
        
        emit DataNFTMinted(to, tokenId, _fileName, _dataURI);
        
        return tokenId;
    }
    
    /**
     * @dev Allows the owner to set the factory address
     * @param newFactoryAddress The new factory address
     */
    function setFactoryAddress(address newFactoryAddress) public onlyOwner {
        factoryAddress = newFactoryAddress;
    }
    
    /**
     * @dev Returns the data URI for a token
     * @param tokenId The token ID
     * @return The data URI
     */
    function dataURI(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "URI query for nonexistent token");
        return _dataURIs[tokenId];
    }
    
    /**
     * @dev Returns the file name for a token
     * @param tokenId The token ID
     * @return The file name
     */
    function fileName(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "Name query for nonexistent token");
        return _fileNames[tokenId];
    }
    
    /**
     * @dev Generates a JSON metadata string for a token
     * @param tokenId The token ID
     * @return The JSON metadata string
     */
    function _generateMetadata(uint256 tokenId) internal view returns (string memory) {
        string memory name = _fileNames[tokenId];
        string memory image = _dataURIs[tokenId];
        
        return string(
            abi.encodePacked(
                '{"name":"', 
                name,
                '","description":"Data NFT minted from Honey Store","image":"', 
                image,
                '","attributes":[{"trait_type":"Token ID","value":"',
                tokenId.toString(),
                '"}]}'
            )
        );
    }
    
    /**
     * @dev Implementation of the {IERC721Metadata-tokenURI} function
     * @param tokenId The token ID
     * @return The token URI with Base64 encoded metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "URI query for nonexistent token");
        
        string memory json = _generateMetadata(tokenId);
        string memory encodedJson = Base64.encode(bytes(json));
        
        return string(abi.encodePacked("data:application/json;base64,", encodedJson));
    }
} 