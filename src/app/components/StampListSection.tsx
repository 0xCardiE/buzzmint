import React, { useState, useEffect } from 'react';
import styles from './css/StampListSection.module.css';
import { formatUnits } from 'viem';
import { UploadStep } from './types';
import { GNOSIS_CUSTOM_REGISTRY_ADDRESS, STORAGE_OPTIONS, REGISTRY_ABI } from './constants';
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';

interface StampListSectionProps {
  setShowStampList: (show: boolean) => void;
  address: string | undefined;
  beeApiUrl: string;
  setPostageBatchId: (id: string) => void;
  setShowOverlay: (show: boolean) => void;
  setUploadStep: (step: UploadStep) => void;
}

interface BatchEvent {
  batchId: string;
  totalAmount: string;
  depth: number;
  size: string;
  timestamp?: number;
  utilization?: number;
  batchTTL?: number;
}

interface StampInfo {
  batchID: string;
  utilization: number;
  usable: boolean;
  label: string;
  depth: number;
  amount: string;
  bucketDepth: number;
  blockNumber: number;
  immutableFlag: boolean;
  exists: boolean;
  batchTTL: number;
}

const StampListSection: React.FC<StampListSectionProps> = ({
  setShowStampList,
  address,
  beeApiUrl,
  setPostageBatchId,
  setShowOverlay,
  setUploadStep,
}) => {
  const [collections, setCollections] = useState<BatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to get the size string for a depth value
  const getSizeForDepth = (depth: number): string => {
    const option = STORAGE_OPTIONS.find(option => option.depth === depth);
    return option ? option.size : `${depth} (unknown size)`;
  };

  useEffect(() => {
    // Move fetchStampInfo inside useEffect since it's only used here
    const fetchCollectionInfo = async (batchId: string): Promise<StampInfo | null> => {
      try {
        const response = await fetch(`${beeApiUrl}/stamps/${batchId.slice(2)}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data;
      } catch (error) {
        console.error(`Error fetching collection info for ${batchId}:`, error);
        return null;
      }
    };

    const fetchCollections = async () => {
      if (!address) {
        setIsLoading(false);
        return;
      }

      try {
        // Create a client with the registry ABI
        const client = createPublicClient({
          chain: gnosis,
          transport: http(),
        });

        // Call the getOwnerBatches function from the registry
        const batchesData = await client.readContract({
          address: GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`,
          abi: REGISTRY_ABI,
          functionName: 'getOwnerBatches',
          args: [address as `0x${string}`],
        });

        // Process the batches data
        const collectionPromises = (batchesData as any[]).map(async batch => {
          const batchId = batch.batchId.toString();
          const collectionInfo = await fetchCollectionInfo(batchId);

          // Skip this collection if collectionInfo is null (expired or non-existent)
          if (!collectionInfo) {
            return null;
          }

          const depth = Number(batch.depth);

          return {
            batchId,
            totalAmount: formatUnits(batch.totalAmount, 16),
            depth,
            size: getSizeForDepth(depth),
            timestamp: Number(batch.timestamp),
            utilization: collectionInfo.utilization,
            batchTTL: collectionInfo.batchTTL,
          };
        });

        // Resolve all promises and filter out null values (expired collections)
        const collectionEventsWithNull = await Promise.all(collectionPromises);
        const collectionEvents = collectionEventsWithNull.filter(
          (collection): collection is NonNullable<typeof collection> => collection !== null
        );

        setCollections(collectionEvents.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      } catch (error) {
        console.error('Error fetching collections:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollections();
  }, [address, beeApiUrl]); // Only dependencies that actually need to trigger re-fetching

  const handleCollectionSelect = (stamp: any) => {
    setPostageBatchId(stamp.batchId.slice(2));
    setShowOverlay(true);
    setUploadStep('ready');
    setShowStampList(false);
  };

  return (
    <div className={styles.stampListContainer}>
      <div className={styles.stampListContent}>
        <div className={styles.stampListHeader}>
          <h2>Your Collections</h2>
        </div>

        {!address ? (
          <div className={styles.stampListLoading}>Connect wallet to check collections</div>
        ) : isLoading ? (
          <div className={styles.stampListLoading}>Loading collections...</div>
        ) : collections.length === 0 ? (
          <div className={styles.stampListEmpty}>No collections found</div>
        ) : (
          <>
            {collections.map((stamp, index) => (
              <div key={index} className={styles.stampListItem}>
                <div
                  className={styles.stampListId}
                  onClick={() => {
                    const idToCopy = stamp.batchId.startsWith('0x')
                      ? stamp.batchId.slice(2)
                      : stamp.batchId;
                    navigator.clipboard.writeText(idToCopy);
                    // Show temporary "Copied!" message
                    const element = document.querySelector(`[data-stamp-id="${stamp.batchId}"]`);
                    if (element) {
                      element.setAttribute('data-copied', 'true');
                      setTimeout(() => {
                        element.setAttribute('data-copied', 'false');
                      }, 2000);
                    }
                  }}
                  data-stamp-id={stamp.batchId}
                  data-copied="false"
                  title="Click to copy stamp ID"
                >
                  ID: {stamp.batchId.startsWith('0x') ? stamp.batchId.slice(2) : stamp.batchId}
                </div>
                <div className={styles.stampListDetails}>
                  <span>Paid: {Number(stamp.totalAmount).toFixed(2)} BZZ</span>
                  <span>Size: {stamp.size}</span>
                  {stamp.utilization !== undefined && (
                    <span>Utilization: {stamp.utilization}%</span>
                  )}
                  {stamp.batchTTL !== undefined && (
                    <span>Expires: {Math.floor(stamp.batchTTL / 86400)} days</span>
                  )}
                  {stamp.timestamp && (
                    <span>Created: {new Date(stamp.timestamp * 1000).toLocaleDateString()}</span>
                  )}
                </div>
                <div className={styles.stampActions}>
                  <button
                    className={styles.uploadWithStampButton}
                    onClick={() => {
                      handleCollectionSelect(stamp);
                    }}
                  >
                    Upload with this collection
                  </button>

                  <button
                    className={styles.topUpButton}
                    title="Top up this collection"
                    onClick={() => {
                      try {
                        console.log('Top-up button clicked');
                        // Format the batch ID (ensure no 0x prefix for URL)
                        const formattedId = stamp.batchId.startsWith('0x')
                          ? stamp.batchId.slice(2)
                          : stamp.batchId;

                        // Create the topup URL
                        const topupUrl = `${window.location.origin}/?topup=${formattedId}`;
                        console.log('Opening new page:', topupUrl);

                        // Use window.open which forces a completely new page load
                        // The "_self" ensures it replaces the current page
                        window.open(topupUrl, '_self');
                      } catch (error) {
                        console.error('Error during top-up navigation:', error);
                        // Emergency fallback if all else fails
                        alert(
                          'Navigation failed. Please copy the collection ID and use it manually.'
                        );
                      }
                    }}
                  >
                    {/* Plus/Add icon in SVG format */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span style={{ marginLeft: '4px' }}>Top Up</span>
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default StampListSection;
