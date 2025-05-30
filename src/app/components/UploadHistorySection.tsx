import React, { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import styles from './css/UploadHistorySection.module.css';
import {
  BUZZMINT_FACTORY_ADDRESS,
  BUZZMINT_FACTORY_ABI,
  BUZZMINT_COLLECTION_ABI,
  BEE_GATEWAY_URL,
} from './constants';

interface UploadHistoryProps {
  address: string | undefined;
  setShowUploadHistory: (show: boolean) => void;
}

interface NFTItem {
  tokenId: number;
  fileName: string;
  dataURI: string;
  imageUrl: string;
  timestamp?: number;
}

interface NFTCollection {
  stampId: string;
  contractAddress: string;
  name: string;
  symbol: string;
  nfts: NFTItem[];
  totalNFTs: number;
  isLoading: boolean;
}

const UploadHistorySection: React.FC<UploadHistoryProps> = ({ address, setShowUploadHistory }) => {
  const publicClient = usePublicClient();
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's NFT collections and their NFTs
  useEffect(() => {
    if (!address || !publicClient) return;

    const fetchCollections = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get user's stamp IDs from factory contract
        const stampIds = (await publicClient.readContract({
          address: BUZZMINT_FACTORY_ADDRESS,
          abi: BUZZMINT_FACTORY_ABI,
          functionName: 'getUserStampIds',
          args: [address],
        })) as string[];

        if (stampIds.length === 0) {
          setCollections([]);
          setIsLoading(false);
          return;
        }

        // Fetch collection details for each stamp ID
        const collectionPromises = stampIds.map(async stampId => {
          try {
            // Get contract address for this stamp ID
            const contractAddress = (await publicClient.readContract({
              address: BUZZMINT_FACTORY_ADDRESS,
              abi: BUZZMINT_FACTORY_ABI,
              functionName: 'getContractAddress',
              args: [stampId],
            })) as string;

            if (contractAddress === '0x0000000000000000000000000000000000000000') {
              return null;
            }

            // Get collection name and symbol
            const [name, symbol, nextTokenId] = await Promise.all([
              publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: BUZZMINT_COLLECTION_ABI,
                functionName: 'name',
              }) as Promise<string>,
              publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: BUZZMINT_COLLECTION_ABI,
                functionName: 'symbol',
              }) as Promise<string>,
              publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: BUZZMINT_COLLECTION_ABI,
                functionName: 'getNextTokenId',
              }) as Promise<bigint>,
            ]);

            const totalNFTs = Number(nextTokenId) - 1; // nextTokenId is 1-based, so total is nextTokenId - 1

            const collection: NFTCollection = {
              stampId,
              contractAddress,
              name,
              symbol,
              nfts: [],
              totalNFTs,
              isLoading: true,
            };

            return collection;
          } catch (error) {
            console.error(`Error fetching collection for stamp ID ${stampId}:`, error);
            return null;
          }
        });

        const collectionsData = (await Promise.all(collectionPromises)).filter(
          Boolean
        ) as NFTCollection[];
        setCollections(collectionsData);

        // Now fetch NFTs for each collection
        const updatedCollections = await Promise.all(
          collectionsData.map(async collection => {
            if (collection.totalNFTs === 0) {
              return { ...collection, isLoading: false };
            }

            try {
              // Fetch NFT data for each token ID (starting from 1)
              const nftPromises = Array.from({ length: collection.totalNFTs }, (_, i) => {
                const tokenId = i + 1;
                return fetchNFTData(collection.contractAddress, tokenId);
              });

              const nfts = (await Promise.all(nftPromises)).filter(Boolean) as NFTItem[];

              return {
                ...collection,
                nfts: nfts.sort((a, b) => b.tokenId - a.tokenId), // Sort by token ID descending (newest first)
                isLoading: false,
              };
            } catch (error) {
              console.error(`Error fetching NFTs for collection ${collection.name}:`, error);
              return { ...collection, isLoading: false };
            }
          })
        );

        setCollections(updatedCollections);
      } catch (error) {
        console.error('Error fetching collections:', error);
        setError('Failed to load NFT collections');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollections();
  }, [address, publicClient]);

  // Helper function to fetch individual NFT data
  const fetchNFTData = async (
    contractAddress: string,
    tokenId: number
  ): Promise<NFTItem | null> => {
    if (!publicClient) return null;

    try {
      const [fileName, dataURI] = await Promise.all([
        publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: BUZZMINT_COLLECTION_ABI,
          functionName: 'fileName',
          args: [BigInt(tokenId)],
        }) as Promise<string>,
        publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: BUZZMINT_COLLECTION_ABI,
          functionName: 'dataURI',
          args: [BigInt(tokenId)],
        }) as Promise<string>,
      ]);

      // Convert dataURI to image URL for thumbnail
      const imageUrl = dataURI.startsWith('bzz://')
        ? dataURI.replace('bzz://', BEE_GATEWAY_URL)
        : dataURI;

      return {
        tokenId,
        fileName,
        dataURI,
        imageUrl,
      };
    } catch (error) {
      console.error(`Error fetching NFT data for token ${tokenId}:`, error);
      return null;
    }
  };

  const formatStampId = (stampId: string) => {
    if (!stampId || stampId.length < 10) return stampId;
    return `${stampId.slice(0, 6)}...${stampId.slice(-4)}`;
  };

  const formatContractAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!address) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>NFT History</h2>
          <div className={styles.buttonGroup}>
            <button className={styles.downloadButton} title="Download CSV">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>
        </div>
        <div className={styles.emptyState}>Connect wallet to view your NFT collections</div>
        <button className={styles.backButton} onClick={() => setShowUploadHistory(false)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>NFT History</h2>
        <div className={styles.buttonGroup}>
          <button className={styles.downloadButton} title="Download CSV">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7,10 12,15 17,10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading your NFT collections...</p>
        </div>
      ) : error ? (
        <div className={styles.errorState}>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : collections.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No NFT collections found</p>
          <p>Create your first NFT by uploading a file!</p>
        </div>
      ) : (
        <div className={styles.collectionsGrid}>
          {collections.map(collection => (
            <div key={collection.stampId} className={styles.collectionCard}>
              <div className={styles.collectionHeader}>
                <div className={styles.collectionInfo}>
                  <h3 className={styles.collectionName}>{collection.name}</h3>
                  <p className={styles.collectionSymbol}>{collection.symbol}</p>
                  <div className={styles.collectionMeta}>
                    <span className={styles.nftCount}>{collection.totalNFTs} NFTs</span>
                    <span className={styles.stampIdLabel}>
                      Collection ID: {formatStampId(collection.stampId)}
                    </span>
                  </div>
                </div>
                <div className={styles.contractInfo}>
                  <a
                    href={`https://gnosis.blockscout.com/address/${collection.contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.contractLink}
                    title={collection.contractAddress}
                  >
                    {formatContractAddress(collection.contractAddress)}
                  </a>
                </div>
              </div>

              {collection.isLoading ? (
                <div className={styles.nftLoading}>
                  <div className={styles.smallSpinner}></div>
                  <p>Loading NFTs...</p>
                </div>
              ) : collection.nfts.length === 0 ? (
                <div className={styles.noNfts}>No NFTs in this collection</div>
              ) : (
                <div className={styles.nftGrid}>
                  {collection.nfts.slice(0, 6).map(nft => (
                    <div key={nft.tokenId} className={styles.nftItem}>
                      <div className={styles.nftThumbnail}>
                        <img
                          src={nft.imageUrl}
                          alt={nft.fileName}
                          className={styles.nftImage}
                          onError={e => {
                            // Fallback to a placeholder if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.src =
                              'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjVGNURDIi8+CjxwYXRoIGQ9Ik0zMCA3MEw1MCA0MEw3MCA3MEgzMFoiIGZpbGw9IiNGRjZCNkIiLz4KPGNpcmNsZSBjeD0iMzUiIGN5PSIzNSIgcj0iNSIgZmlsbD0iIzRFQ0RDNCIvPgo8L3N2Zz4K';
                          }}
                        />
                      </div>
                      <div className={styles.nftInfo}>
                        <p className={styles.nftFileName}>{nft.fileName}</p>
                        <p className={styles.nftTokenId}>#{nft.tokenId}</p>
                      </div>
                    </div>
                  ))}
                  {collection.nfts.length > 6 && (
                    <div className={styles.moreNfts}>+{collection.nfts.length - 6} more</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button className={styles.backButton} onClick={() => setShowUploadHistory(false)}>
        Back
      </button>
    </div>
  );
};

export default UploadHistorySection;
