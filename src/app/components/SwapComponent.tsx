'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient, useSwitchChain } from 'wagmi';
import { watchChainId, getWalletClient } from '@wagmi/core';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { config } from '@/app/wagmi';
import { createConfig, EVM, executeRoute, ChainId, ChainType, getChains, Chain } from '@lifi/sdk';
import styles from './css/SwapComponent.module.css';
import { parseAbi, formatUnits } from 'viem';
import { getAddress } from 'viem';

import { ExecutionStatus, UploadStep } from './types';
import {
  GNOSIS_PRICE_ORACLE_ADDRESS,
  GNOSIS_PRICE_ORACLE_ABI,
  DEFAULT_NODE_ADDRESS,
  GNOSIS_BZZ_ADDRESS,
  DEFAULT_SWARM_CONFIG,
  STORAGE_OPTIONS,
  BEE_GATEWAY_URL,
  GNOSIS_DESTINATION_TOKEN,
  TIME_OPTIONS,
  GNOSIS_CUSTOM_REGISTRY_ADDRESS,
  DEFAULT_BEE_API_URL,
  MIN_TOKEN_BALANCE_USD,
  LIFI_API_KEY,
  DISABLE_MESSAGE_SIGNING,
  ACCEPT_EXCHANGE_RATE_UPDATES,
  BUZZMINT_FACTORY_ADDRESS,
  BUZZMINT_FACTORY_ABI,
  BUZZMINT_COLLECTION_ABI,
} from './constants';

import HelpSection from './HelpSection';
import StampListSection from './StampListSection';
import UploadHistorySection from './UploadHistorySection';
import SearchableChainDropdown from './SearchableChainDropdown';
import SearchableTokenDropdown from './SearchableTokenDropdown';

import {
  formatErrorMessage,
  createBatchId,
  readBatchId,
  performWithRetry,
  toChecksumAddress,
  getGnosisPublicClient,
  setGnosisRpcUrl,
  handleExchangeRateUpdate,
} from './utils';
import { useTimer } from './TimerUtils';

import { getGnosisQuote, getCrossChainQuote } from './CustomQuotes';
import { handleFileUpload as uploadFile, isArchiveFile } from './FileUploadUtils';
import { generateAndUpdateNonce } from './utils';
import { useTokenManagement } from './TokenUtils';

// Update the StampInfo interface to include the additional properties
interface StampInfo {
  batchID: string;
  utilization: number;
  usable: boolean;
  depth: number;
  amount: string;
  bucketDepth: number;
  exists: boolean;
  batchTTL: number;
  // Add the additional properties we're using
  totalSize?: string;
  usedSize?: string;
  remainingSize?: string;
  utilizationPercent?: number;
}

const SwapComponent: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { openConnectModal } = useConnectModal();

  // Add state to track if component has mounted to prevent hydration mismatches
  const [hasMounted, setHasMounted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<bigint | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [selectedDepth, setSelectedDepth] = useState(20);
  const [nodeAddress, setNodeAddress] = useState<string>(DEFAULT_NODE_ADDRESS);
  const [isWebpageUpload, setIsWebpageUpload] = useState(false);
  const [isTarFile, setIsTarFile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [totalUsdAmount, setTotalUsdAmount] = useState<string | null>(null);
  const [availableChains, setAvailableChains] = useState<Chain[]>([]);
  const [isChainsLoading, setIsChainsLoading] = useState(true);
  const [liquidityError, setLiquidityError] = useState<boolean>(false);
  const [insufficientFunds, setInsufficientFunds] = useState<boolean>(false);
  const [isPriceEstimating, setIsPriceEstimating] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<ExecutionStatus>({
    step: '',
    message: '',
  });
  const [showOverlay, setShowOverlay] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showStampList, setShowStampList] = useState(false);

  const [isWalletLoading, setIsWalletLoading] = useState(true);
  const [postageBatchId, setPostageBatchId] = useState<string>('');
  const [topUpBatchId, setTopUpBatchId] = useState<string | null>(null);
  const [isTopUp, setIsTopUp] = useState(false);

  // Use the token management hook
  const {
    fromToken,
    setFromToken,
    selectedTokenInfo,
    setSelectedTokenInfo,
    availableTokens,
    tokenBalances,
    isTokensLoading,
    fetchTokensAndBalances,
    resetTokens,
  } = useTokenManagement(address, isConnected);

  const [beeApiUrl, setBeeApiUrl] = useState<string>(DEFAULT_BEE_API_URL);

  const [swarmConfig, setSwarmConfig] = useState(DEFAULT_SWARM_CONFIG);

  const [isCustomNode, setIsCustomNode] = useState(false);

  const [showUploadHistory, setShowUploadHistory] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const [serveUncompressed, setServeUncompressed] = useState(true);

  // Add states to track top-up completion
  const [topUpCompleted, setTopUpCompleted] = useState(false);
  const [topUpInfo, setTopUpInfo] = useState<{
    batchId: string;
    days: number;
    cost: string;
  } | null>(null);

  // Add states for new workflow: collection creation after storage
  const [showPostStorageCollectionForm, setShowPostStorageCollectionForm] = useState(false);
  const [createdStorageInfo, setCreatedStorageInfo] = useState<{
    batchId: string;
    cost: string;
    days: number;
  } | null>(null);
  const [createdCollectionInfo, setCreatedCollectionInfo] = useState<{
    contractAddress: string;
    name: string;
    symbol: string;
    stampId: string;
  } | null>(null);

  // Add state to track if this is the first NFT upload
  const [isFirstNftUpload, setIsFirstNftUpload] = useState(false);

  // Add state for transition loading
  const [isTransitionLoading, setIsTransitionLoading] = useState(false);

  // Add state for collection-to-upload transition loading
  const [isUploadTransitionLoading, setIsUploadTransitionLoading] = useState(false);

  // Add a ref to track the current wallet client
  const currentWalletClientRef = useRef(walletClient);

  // Update the ref whenever walletClient changes
  useEffect(() => {
    currentWalletClientRef.current = walletClient;
  }, [walletClient]);

  const { estimatedTime, setEstimatedTime, remainingTime, formatTime, resetTimer } =
    useTimer(statusMessage);

  // Add a ref for the abort controller
  const priceEstimateAbortControllerRef = useRef<AbortController | null>(null);

  // Add state for custom RPC
  const [isCustomRpc, setIsCustomRpc] = useState(false);
  const [customRpcUrl, setCustomRpcUrl] = useState<string>('');

  // Add state for OpenAI API key
  const [openAiApiKey, setOpenAiApiKey] = useState<string>('');

  // Add state for AI image generation
  const [uploadMode, setUploadMode] = useState<'file' | 'ai'>('file');
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('');

  // Watch for changes to custom RPC URL settings and update global setting
  useEffect(() => {
    // Update the global RPC URL when custom RPC settings change
    setGnosisRpcUrl(isCustomRpc ? customRpcUrl : undefined);
  }, [isCustomRpc, customRpcUrl]);

  // Load OpenAI API key from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedApiKey = localStorage.getItem('buzzmint_openai_key');
      if (savedApiKey) {
        setOpenAiApiKey(savedApiKey);
      }
    }
  }, []);

  // Save OpenAI API key to localStorage whenever it changes
  const handleOpenAiKeyChange = (newKey: string) => {
    setOpenAiApiKey(newKey);
    if (typeof window !== 'undefined') {
      if (newKey.trim()) {
        localStorage.setItem('buzzmint_openai_key', newKey.trim());
      } else {
        localStorage.removeItem('buzzmint_openai_key');
      }
    }
  };

  // AI Image Generation function
  const generateAiImage = async (prompt: string): Promise<string> => {
    if (!openAiApiKey) {
      throw new Error('OpenAI API key is required for AI image generation');
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json', // Use base64 instead of URL to avoid CORS
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].b64_json;
  };

  // Convert base64 to File object
  const base64ToFile = async (base64Data: string, filename: string): Promise<File> => {
    // Create data URL from base64
    const dataUrl = `data:image/png;base64,${base64Data}`;

    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    return new File([blob], filename, { type: 'image/png' });
  };

  // Handle AI image generation
  const handleAiGeneration = async () => {
    if (!aiPrompt.trim()) {
      alert('Please enter a prompt for AI image generation');
      return;
    }

    if (!openAiApiKey) {
      alert('Please configure your OpenAI API key in Settings first');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const base64Data = await generateAiImage(aiPrompt.trim());

      // Create data URL for display
      const imageDataUrl = `data:image/png;base64,${base64Data}`;
      setGeneratedImageUrl(imageDataUrl);

      // Convert the generated image to a File object
      const filename = `ai-generated-${Date.now()}.png`;
      const file = await base64ToFile(base64Data, filename);
      setSelectedFile(file);
      setIsTarFile(false);

      // Ensure upload step is ready so the upload button becomes enabled
      setUploadStep('ready');
    } catch (error) {
      console.error('AI generation error:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Initial setup that runs only once to set the chain ID from wallet
  useEffect(() => {
    if (chainId && !isInitialized) {
      console.log('Initial chain setup with ID:', chainId);
      setSelectedChainId(chainId);
      setIsInitialized(true);
    }
  }, [chainId, isInitialized]);

  useEffect(() => {
    const init = async () => {
      setIsWalletLoading(true);
      if (isConnected && address && isInitialized) {
        setSelectedDays(null);
        resetTokens();
      }
      setIsWalletLoading(false);
    };

    init();
  }, [isConnected, address, isInitialized]);

  // Separate useEffect to fetch tokens after selectedChainId is updated
  useEffect(() => {
    if (selectedChainId && isInitialized) {
      console.log('Fetching tokens with chain ID:', selectedChainId);
      fetchTokensAndBalances(selectedChainId);
    }
  }, [selectedChainId, isInitialized, isConnected, address]);

  useEffect(() => {
    if (chainId && isInitialized) {
      // Only update selectedChainId if we've already initialized
      // This handles chain switching after initial load
      if (chainId !== selectedChainId) {
        console.log('Chain changed from', selectedChainId, 'to', chainId);
        setSelectedChainId(chainId);
        setSelectedDays(null);
        resetTokens();
      }
    }
  }, [chainId, isInitialized]);

  useEffect(() => {
    const fetchAndSetNode = async () => {
      await fetchNodeWalletAddress();
    };
    fetchAndSetNode();
  }, [beeApiUrl]);

  useEffect(() => {
    if (isConnected && publicClient && walletClient) {
      // Reinitialize LiFi whenever the wallet changes
      initializeLiFi();
    } else {
    }
  }, [isConnected, publicClient, walletClient, address]);

  useEffect(() => {
    // Execute first two functions immediately
    fetchCurrentPrice();
    fetchNodeWalletAddress();
  }, [isConnected, address]);

  useEffect(() => {
    const fetchChains = async () => {
      try {
        setIsChainsLoading(true);
        const chains = await getChains({ chainTypes: [ChainType.EVM] });

        // Define the allowed chain IDs for buzzMint
        const allowedChainIds = [
          1, // Ethereum Mainnet
          100, // Gnosis
          42161, // Arbitrum One
          10, // Optimism
          8453, // Base
          137, // Polygon
          30, // Rootstock
          2741, // Abstract
          80094, // Berachain
        ];

        // Filter chains to only include the allowed ones
        const filteredChains = chains.filter(chain => allowedChainIds.includes(chain.id));

        setAvailableChains(filteredChains);
      } catch (error) {
        console.error('Error fetching chains:', error);
      } finally {
        setIsChainsLoading(false);
      }
    };

    fetchChains();
  }, []);

  useEffect(() => {
    if (!selectedDays || selectedDays === 0) {
      setTotalUsdAmount(null);
      setSwarmConfig(DEFAULT_SWARM_CONFIG);
      return;
    }

    if (!currentPrice) return;

    try {
      updateSwarmBatchInitialBalance();
    } catch (error) {
      console.error('Error calculating total cost:', error);
      setTotalUsdAmount(null);
      setSwarmConfig(DEFAULT_SWARM_CONFIG);
    }
  }, [currentPrice, selectedDays, selectedDepth]);

  useEffect(() => {
    if (!isConnected || !address || !fromToken) return;
    setTotalUsdAmount(null);
    setLiquidityError(false);
    setIsPriceEstimating(true);

    // Cancel any previous price estimate operations
    if (priceEstimateAbortControllerRef.current) {
      console.log('Cancelling previous price estimate');
      priceEstimateAbortControllerRef.current.abort();
    }

    // Create a new abort controller for this run
    priceEstimateAbortControllerRef.current = new AbortController();
    const abortSignal = priceEstimateAbortControllerRef.current.signal;

    const updatePriceEstimate = async () => {
      if (!selectedChainId) return;

      // Reset insufficient funds state at the beginning of new price estimation
      setInsufficientFunds(false);

      try {
        const bzzAmount = calculateTotalAmount().toString();
        const gnosisSourceToken =
          selectedChainId === ChainId.DAI ? fromToken : GNOSIS_DESTINATION_TOKEN;

        // Add detailed logging
        console.log('BZZ amount needed:', formatUnits(BigInt(bzzAmount), 16));
        console.log('Selected days:', selectedDays);
        console.log(
          'Selected collection size:',
          STORAGE_OPTIONS.find(option => option.depth === selectedDepth)?.size
        );

        const { gnosisContactCallsQuoteResponse } = await performWithRetry(
          () =>
            getGnosisQuote({
              gnosisSourceToken,
              address,
              bzzAmount,
              nodeAddress,
              swarmConfig,
              setEstimatedTime,
              extendBatchId: isTopUp ? topUpBatchId || undefined : undefined, // Only pass if it's an extension
            }),
          'getGnosisQuote-execution',
          undefined,
          5, // 5 retries
          500 // 500ms delay between retries
        );

        // If operation was aborted, don't continue
        if (abortSignal.aborted) {
          console.log('Price estimate aborted after Gnosis quote');
          return;
        }

        let totalAmount = Number(gnosisContactCallsQuoteResponse.estimate.fromAmountUSD || 0);

        if (selectedChainId !== ChainId.DAI) {
          const { crossChainContractQuoteResponse } = await performWithRetry(
            () =>
              getCrossChainQuote({
                selectedChainId,
                fromToken,
                address,
                toAmount: gnosisContactCallsQuoteResponse.estimate.fromAmount,
                gnosisDestinationToken: GNOSIS_DESTINATION_TOKEN,
                setEstimatedTime,
              }),
            'getCrossChainQuote',
            undefined,
            5,
            300,
            abortSignal
          );

          // If operation was aborted, don't continue
          if (abortSignal.aborted) {
            console.log('Price estimate aborted after cross-chain quote');
            return;
          }

          // Add to total amount bridge fees
          const bridgeFees = crossChainContractQuoteResponse.estimate.feeCosts
            ? crossChainContractQuoteResponse.estimate.feeCosts.reduce(
                (total, fee) => total + Number(fee.amountUSD || 0),
                0
              )
            : 0;

          console.log('Bridge fees:', bridgeFees);
          console.log(
            'Gas fees:',
            crossChainContractQuoteResponse.estimate.gasCosts?.[0]?.amountUSD || '0'
          );
          console.log(
            'Cross chain amount:',
            crossChainContractQuoteResponse.estimate.fromAmountUSD
          );

          totalAmount = Number(crossChainContractQuoteResponse.estimate.fromAmountUSD || 0);
        }

        // One final check if aborted before updating state
        if (!abortSignal.aborted) {
          console.log('Total amount:', totalAmount);
          setTotalUsdAmount(totalAmount.toString());

          // Check if user has enough funds
          if (selectedTokenInfo) {
            const tokenBalanceInUsd =
              Number(formatUnits(selectedTokenInfo.amount || 0n, selectedTokenInfo.decimals)) *
              Number(selectedTokenInfo.priceUSD);

            console.log('User token balance in USD:', tokenBalanceInUsd);
            console.log('Required amount in USD:', totalAmount);

            // Set insufficient funds flag if cost exceeds available balance
            setInsufficientFunds(totalAmount > tokenBalanceInUsd);
          }
        }
      } catch (error) {
        // Only update error state if not aborted
        if (!abortSignal.aborted) {
          console.error('Error estimating price:', error);
          setTotalUsdAmount(null);
          setLiquidityError(true);
        }
      } finally {
        // Only update loading state if not aborted
        if (!abortSignal.aborted) {
          setIsPriceEstimating(false);
        }
      }
    };

    if (selectedDays) {
      updatePriceEstimate();
    } else {
      // If no days selected, still reset the loading state
      setIsPriceEstimating(false);
    }

    // Cleanup: abort any pending operations when the effect is cleaned up
    return () => {
      if (priceEstimateAbortControllerRef.current) {
        priceEstimateAbortControllerRef.current.abort();
        priceEstimateAbortControllerRef.current = null;
      }
    };
  }, [swarmConfig.swarmBatchTotal]);

  // Initialize LiFi function
  const initializeLiFi = () => {
    // Create new config instead of modifying existing one
    createConfig({
      integrator: 'Swarm',
      apiKey: LIFI_API_KEY,
      providers: [
        EVM({
          getWalletClient: async () => {
            // Use the ref instead of the direct walletClient
            const client = currentWalletClientRef.current;
            if (!client) throw new Error('Wallet client not available');
            return client;
          },
          switchChain: async chainId => {
            if (switchChain) {
              switchChain({ chainId });
            }
            // Get a fresh wallet client for the new chain
            try {
              // Wait briefly for the chain to switch
              await new Promise(resolve => setTimeout(resolve, 500));
              // Create a new wallet client with the specified chainId
              const client = await getWalletClient(config, { chainId });
              // Update our ref
              currentWalletClientRef.current = client;
              return client;
            } catch (error) {
              console.error('Error getting wallet client:', error);
              if (currentWalletClientRef.current) return currentWalletClientRef.current;
              throw new Error('Failed to get wallet client for the new chain');
            }
          },
        }),
      ],
    });
  };

  const fetchNodeWalletAddress = async () => {
    try {
      const response = await fetch(`${beeApiUrl}/wallet`, {
        signal: AbortSignal.timeout(15000),
      });
      setNodeAddress(DEFAULT_NODE_ADDRESS);
      if (response.ok) {
        const data = await response.json();
        if (data.walletAddress) {
          setNodeAddress(data.walletAddress);
          console.log('Node wallet address set:', data.walletAddress);
        }
      }
    } catch (error) {
      console.error('Error fetching node wallet address:', error);
    }
  };

  const fetchCurrentPrice = async () => {
    if (publicClient) {
      try {
        // Just use getGnosisPublicClient directly, it will use the global RPC URL
        const price = await getGnosisPublicClient().readContract({
          address: GNOSIS_PRICE_ORACLE_ADDRESS as `0x${string}`,
          abi: GNOSIS_PRICE_ORACLE_ABI,
          functionName: 'currentPrice',
        });
        console.log('price', price);
        setCurrentPrice(BigInt(price));
      } catch (error) {
        console.error('Error fetching current price:', error);
        setCurrentPrice(BigInt(28000));
      }
    } else {
      setCurrentPrice(BigInt(28000));
    }
  };

  const updateSwarmBatchInitialBalance = () => {
    if (currentPrice !== null) {
      const initialPaymentPerChunkPerDay = BigInt(currentPrice) * BigInt(17280);
      const totalPricePerDuration =
        BigInt(initialPaymentPerChunkPerDay) * BigInt(selectedDays || 1);

      // Calculate total amount based on whether this is a top-up or new batch
      let depthToUse: number;

      if (isTopUp && originalStampInfo) {
        // For top-ups, use the original depth from the stamp
        depthToUse = originalStampInfo.depth;
      } else {
        // For new batches, use the selected depth
        depthToUse = selectedDepth;
      }

      const totalAmount = totalPricePerDuration * BigInt(2 ** depthToUse);

      setSwarmConfig(prev => ({
        ...prev,
        swarmBatchInitialBalance: totalPricePerDuration.toString(),
        swarmBatchTotal: totalAmount.toString(),
      }));
    }
  };

  const calculateTotalAmount = () => {
    const price = currentPrice || 0n; // Use 0n as default if currentPrice is null
    const initialPaymentPerChunkPerDay = price * 17280n;
    const totalPricePerDuration = initialPaymentPerChunkPerDay * BigInt(selectedDays || 1);

    // Use the appropriate depth based on whether this is a top-up
    let depthToUse: number;

    if (isTopUp && originalStampInfo) {
      // For top-ups, use the original depth from the stamp
      depthToUse = originalStampInfo.depth;
    } else {
      // For new batches, use the selected depth
      depthToUse = selectedDepth;
    }

    return totalPricePerDuration * BigInt(2 ** depthToUse);
  };

  const handleDepthChange = (newDepth: number) => {
    setSelectedDepth(newDepth);
    setSwarmConfig(prev => ({
      ...prev,
      swarmBatchDepth: newDepth.toString(),
    }));
  };

  const handleDirectBzzTransactions = async (updatedConfig: any) => {
    // Ensure we have all needed objects and data
    if (!address || !publicClient || !walletClient) {
      console.error('Missing required objects for direct BZZ transaction');
      return;
    }

    try {
      setStatusMessage({
        step: 'Approval',
        message: 'Approving Token...',
      });

      // Calculate amount based on whether this is a top-up or new batch
      let totalAmount: bigint;

      if (isTopUp && originalStampInfo) {
        // For top-ups, use the original depth from the stamp
        totalAmount = calculateTopUpAmount(originalStampInfo.depth);

        // Update swarmBatchInitialBalance for top-up (price per chunk)
        if (currentPrice !== null && selectedDays) {
          const initialPaymentPerChunkPerDay = BigInt(currentPrice) * BigInt(17280);
          const pricePerChunkForDuration = initialPaymentPerChunkPerDay * BigInt(selectedDays);
          setSwarmConfig(prev => ({
            ...prev,
            swarmBatchInitialBalance: pricePerChunkForDuration.toString(),
          }));
        }
      } else {
        // For new batches, use the total from updatedConfig
        totalAmount = BigInt(updatedConfig.swarmBatchTotal);
      }

      // Generate specific transaction message based on operation type
      const operationMsg = isTopUp
        ? `Extending collection ${
            topUpBatchId?.startsWith('0x') ? topUpBatchId.slice(2, 8) : topUpBatchId?.slice(0, 6)
          }...${topUpBatchId?.slice(-4)}`
        : 'Buying storage...';

      // First approve the token transfer
      const approveCallData = {
        address: GNOSIS_BZZ_ADDRESS as `0x${string}`,
        abi: [
          {
            constant: false,
            inputs: [
              { name: '_spender', type: 'address' },
              { name: '_value', type: 'uint256' },
            ],
            name: 'approve',
            outputs: [{ name: 'success', type: 'bool' }],
            type: 'function',
          },
        ],
        functionName: 'approve',
        args: [GNOSIS_CUSTOM_REGISTRY_ADDRESS, totalAmount],
        account: address,
      };

      console.log('Sending approval tx with args:', approveCallData);

      const approveTxHash = await walletClient.writeContract(approveCallData);
      console.log('Approval transaction hash:', approveTxHash);

      // Wait for approval transaction to be mined
      const approveReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveTxHash,
      });

      if (approveReceipt.status === 'success') {
        setStatusMessage({
          step: 'Batch',
          message: operationMsg,
        });

        // Prepare contract write parameters - different based on operation type
        let contractWriteParams;

        if (isTopUp && topUpBatchId) {
          // Top up existing batch
          contractWriteParams = {
            address: GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`,
            abi: parseAbi(updatedConfig.swarmContractAbi),
            functionName: 'topUpBatch',
            args: [topUpBatchId as `0x${string}`, updatedConfig.swarmBatchInitialBalance],
            account: address,
          };
        } else {
          // Create new batch
          contractWriteParams = {
            address: GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`,
            abi: parseAbi(updatedConfig.swarmContractAbi),
            functionName: 'createBatchRegistry',
            args: [
              address,
              nodeAddress,
              updatedConfig.swarmBatchInitialBalance,
              updatedConfig.swarmBatchDepth,
              updatedConfig.swarmBatchBucketDepth,
              updatedConfig.swarmBatchNonce,
              updatedConfig.swarmBatchImmutable,
            ],
            account: address,
          };
        }

        console.log('Creating second transaction with params:', contractWriteParams);

        // Execute the batch creation or top-up
        const batchTxHash = await walletClient.writeContract(contractWriteParams);
        console.log(
          `${isTopUp ? 'Extend collection' : 'Create batch'} transaction hash:`,
          batchTxHash
        );

        // Wait for batch transaction to be mined
        const batchReceipt = await publicClient.waitForTransactionReceipt({
          hash: batchTxHash,
        });

        if (batchReceipt.status === 'success') {
          if (isTopUp) {
            // For top-up, we already have the batch ID
            console.log('Successfully extended collection ID:', topUpBatchId);
            setPostageBatchId(topUpBatchId as string);

            // Set top-up completion info
            setTopUpCompleted(true);
            setTopUpInfo({
              batchId: topUpBatchId as string,
              days: selectedDays || 0,
              cost: totalUsdAmount || '0',
            });

            setStatusMessage({
              step: 'Complete',
              message: 'Collection Extended Successfully',
              isSuccess: true,
            });
            // Don't set upload step for top-ups
          } else {
            try {
              // Calculate the batch ID for logging
              const calculatedBatchId = readBatchId(
                updatedConfig.swarmBatchNonce,
                GNOSIS_CUSTOM_REGISTRY_ADDRESS
              );

              console.log('Batch created successfully with ID:', calculatedBatchId);

              // Store storage info for collection creation
              setCreatedStorageInfo({
                batchId: calculatedBatchId,
                cost: totalUsdAmount || '0',
                days: selectedDays || 0,
              });

              setStatusMessage({
                step: 'Complete',
                message: 'Storage Created Successfully! Now create your NFT collection.',
                isSuccess: true,
              });

              // Show collection creation form instead of upload
              setTimeout(() => {
                setShowOverlay(false);
                setShowPostStorageCollectionForm(true);
              }, 2000);
            } catch (error) {
              console.error('Failed to process batch completion:', error);
              throw new Error('Failed to process batch completion');
            }
          }
        } else {
          throw new Error(`${isTopUp ? 'Extension' : 'Batch creation'} failed`);
        }
      } else {
        throw new Error('Approval failed');
      }
    } catch (error) {
      console.error(`Error in direct BZZ transactions: ${error}`);
      setStatusMessage({
        step: 'Error',
        message: 'Transaction failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isError: true,
      });
    }
  };

  const handleGnosisTokenSwap = async (contractCallsRoute: any, currentConfig: any) => {
    if (!selectedChainId) return;

    setStatusMessage({
      step: 'Route',
      message: 'Executing contract calls...',
    });

    const executedRoute = await executeRoute(contractCallsRoute, {
      disableMessageSigning: DISABLE_MESSAGE_SIGNING,
      acceptExchangeRateUpdateHook: params =>
        handleExchangeRateUpdate(params, setStatusMessage, ACCEPT_EXCHANGE_RATE_UPDATES),
      updateRouteHook: async updatedRoute => {
        console.log('Updated Route:', updatedRoute);
        const status = updatedRoute.steps[0]?.execution?.status;
        console.log(`Status: ${status}`);

        setStatusMessage({
          step: 'Route',
          message: `Status update: ${status?.replace(/_/g, ' ')}`,
        });

        if (status === 'DONE') {
          // Reset timer when done
          resetTimer();

          const txHash = updatedRoute.steps[0]?.execution?.process[0]?.txHash;
          console.log('Created new Batch at trx', txHash);

          try {
            if (isTopUp && topUpBatchId) {
              console.log('Successfully topped up batch ID:', topUpBatchId);
              // Set top-up completion info
              setTopUpCompleted(true);
              setTopUpInfo({
                batchId: topUpBatchId,
                days: selectedDays || 0,
                cost: totalUsdAmount || '0',
              });

              setStatusMessage({
                step: 'Complete',
                message: 'Collection Extended Successfully',
                isSuccess: true,
              });
            } else {
              // Calculate the batch ID for logging
              const calculatedBatchId = readBatchId(
                currentConfig.swarmBatchNonce,
                GNOSIS_CUSTOM_REGISTRY_ADDRESS
              );

              console.log('Batch created successfully with ID:', calculatedBatchId);

              // Store storage creation info for collection creation workflow
              setCreatedStorageInfo({
                batchId: calculatedBatchId,
                cost: totalUsdAmount || '0',
                days: selectedDays || 0,
              });

              setStatusMessage({
                step: 'Complete',
                message: 'Storage Created Successfully! Now create your NFT collection.',
                isSuccess: true,
              });

              // Start transition loading immediately
              setIsTransitionLoading(true);
              setStatusMessage({ step: '', message: '' });

              // After a brief delay, show collection creation form
              setTimeout(() => {
                setIsTransitionLoading(false);
                setShowPostStorageCollectionForm(true);
                setIsLoading(false);
              }, 2000);
            }
          } catch (error) {
            console.error('Failed to create batch ID:', error);
          }
        } else if (status === 'FAILED') {
          // Use the utility function to generate and update the nonce
          generateAndUpdateNonce(currentConfig, setSwarmConfig);

          console.log('Transaction failed, regenerated nonce for recovery');

          // Reset timer if failed
          resetTimer();
        }
      },
    });
    console.log('Contract calls execution completed:', executedRoute);
  };

  const handleCrossChainSwap = async (
    gnosisContractCallsRoute: any,
    toAmount: any,
    updatedConfig: any
  ) => {
    if (!selectedChainId) return;

    setStatusMessage({
      step: 'Quote',
      message: 'Getting quote...',
    });

    const { crossChainContractCallsRoute } = await performWithRetry(
      () =>
        getCrossChainQuote({
          selectedChainId,
          fromToken,
          address: address as string,
          toAmount,
          gnosisDestinationToken: GNOSIS_DESTINATION_TOKEN,
          setEstimatedTime,
        }),
      'getCrossChainQuote-execution',
      undefined,
      5, // 5 retries
      500 // 500ms delay between retries
    );

    const executedRoute = await executeRoute(crossChainContractCallsRoute, {
      disableMessageSigning: DISABLE_MESSAGE_SIGNING,
      acceptExchangeRateUpdateHook: params =>
        handleExchangeRateUpdate(params, setStatusMessage, ACCEPT_EXCHANGE_RATE_UPDATES),
      updateRouteHook: async crossChainContractCallsRoute => {
        console.log('Updated Route 1:', crossChainContractCallsRoute);
        const step1Status = crossChainContractCallsRoute.steps[0]?.execution?.status;
        console.log(`Step 1 Status: ${step1Status}`);

        setStatusMessage({
          step: 'Route',
          message: `Bridging in progress: ${step1Status?.replace(/_/g, ' ')}.`,
        });

        if (step1Status === 'DONE') {
          console.log('Route 1 wallet client:', walletClient);
          await handleChainSwitch(gnosisContractCallsRoute, updatedConfig);
        } else if (step1Status === 'FAILED') {
          // Add reset if the execution fails
          resetTimer();
        }
      },
    });

    console.log('First route execution completed:', executedRoute);
  };

  const handleChainSwitch = async (contractCallsRoute: any, updatedConfig: any) => {
    console.log('First route completed, triggering chain switch to Gnosis...');

    // Reset the timer when the action completes
    resetTimer();

    setStatusMessage({
      step: 'Switch',
      message: 'First route completed. Switching chain to Gnosis...',
    });

    const unwatch = watchChainId(config, {
      onChange: async chainId => {
        if (chainId === ChainId.DAI) {
          console.log('Detected switch to Gnosis, executing second route...');
          unwatch();

          // Get a fresh wallet client for the new chain
          try {
            const newClient = await getWalletClient(config, { chainId });
            console.log('Route 2 wallet client:', newClient);

            // Update our ref
            currentWalletClientRef.current = newClient;

            await handleGnosisRoute(contractCallsRoute, updatedConfig);
          } catch (error) {
            console.error('Error getting new wallet client:', error);
            // Fall back to using the current wallet client
            await handleGnosisRoute(contractCallsRoute, updatedConfig);
          }
        }
      },
    });

    switchChain({ chainId: ChainId.DAI });
  };

  const handleGnosisRoute = async (contractCallsRoute: any, updatedConfig: any) => {
    setStatusMessage({
      step: 'Route',
      message: 'Chain switched. Executing second route...',
    });

    try {
      const executedRoute2 = await executeRoute(contractCallsRoute, {
        disableMessageSigning: DISABLE_MESSAGE_SIGNING,
        acceptExchangeRateUpdateHook: params =>
          handleExchangeRateUpdate(params, setStatusMessage, ACCEPT_EXCHANGE_RATE_UPDATES),
        updateRouteHook: async contractCallsRoute => {
          console.log('Updated Route 2:', contractCallsRoute);
          const step2Status = contractCallsRoute.steps[0]?.execution?.status;
          console.log(`Step 2 Status: ${step2Status}`);

          setStatusMessage({
            step: 'Route',
            message: `Second route status: ${step2Status?.replace(/_/g, ' ')}`,
          });

          if (step2Status === 'DONE') {
            const txHash =
              contractCallsRoute.steps[0]?.execution?.process[1]?.txHash ||
              contractCallsRoute.steps[0]?.execution?.process[0]?.txHash;
            console.log('Created new Batch at trx', txHash);

            try {
              if (isTopUp && topUpBatchId) {
                console.log('Successfully topped up batch ID:', topUpBatchId);
                // Set top-up completion info
                setTopUpCompleted(true);
                setTopUpInfo({
                  batchId: topUpBatchId,
                  days: selectedDays || 0,
                  cost: totalUsdAmount || '0',
                });

                setStatusMessage({
                  step: 'Complete',
                  message: 'Collection Extended Successfully',
                  isSuccess: true,
                });
              } else {
                // Calculate the batch ID for logging
                const calculatedBatchId = readBatchId(
                  updatedConfig.swarmBatchNonce,
                  GNOSIS_CUSTOM_REGISTRY_ADDRESS
                );
                console.log('Batch created successfully with ID:', calculatedBatchId);

                // Store storage creation info for collection creation workflow
                setCreatedStorageInfo({
                  batchId: calculatedBatchId,
                  cost: totalUsdAmount || '0',
                  days: selectedDays || 0,
                });

                setStatusMessage({
                  step: 'Complete',
                  message: 'Storage Created Successfully! Now create your NFT collection.',
                  isSuccess: true,
                });

                // Start transition loading immediately
                setIsTransitionLoading(true);
                setStatusMessage({ step: '', message: '' });

                // After a brief delay, show collection creation form
                setTimeout(() => {
                  setIsTransitionLoading(false);
                  setShowPostStorageCollectionForm(true);
                  setIsLoading(false);
                }, 2000);
              }
            } catch (error) {
              console.error('Failed to create batch ID:', error);
            }
          }
        },
      });
      console.log('Second route execution completed:', executedRoute2);
    } catch (error) {
      console.error('Error executing second route:', error);
      setStatusMessage({
        step: 'Error',
        message: 'Error executing second route',
        error: 'Second route execution failed. Check console for details.',
        isError: true,
      });
    }
  };

  const handleSwap = async () => {
    if (!isConnected || !address || !publicClient || !walletClient || selectedChainId === null) {
      console.error('Wallet not connected, clients not available, or chain not selected');
      return;
    }

    // Reset the timer when starting a new transaction
    resetTimer();

    // Use the utility function to generate and update the nonce
    const updatedConfig = generateAndUpdateNonce(swarmConfig, setSwarmConfig);

    // IMPORTANT: Ensure the updatedConfig has the latest calculated values
    // This fixes the BZZ amount mismatch between price estimation and execution
    if (currentPrice !== null && selectedDays) {
      const initialPaymentPerChunkPerDay = BigInt(currentPrice) * BigInt(17280);
      const totalPricePerDuration = initialPaymentPerChunkPerDay * BigInt(selectedDays);

      // Calculate total amount based on whether this is a top-up or new batch
      let depthToUse: number;
      if (isTopUp && originalStampInfo) {
        // For top-ups, use the original depth from the stamp
        depthToUse = originalStampInfo.depth;
      } else {
        // For new batches, use the selected depth
        depthToUse = selectedDepth;
      }

      const totalAmount = totalPricePerDuration * BigInt(2 ** depthToUse);

      // Update the config with the latest calculated values
      updatedConfig.swarmBatchInitialBalance = totalPricePerDuration.toString();
      updatedConfig.swarmBatchTotal = totalAmount.toString();
      updatedConfig.swarmBatchDepth = depthToUse.toString();
    }

    // For new batches (not top-ups), create the batch ID once here
    if (!isTopUp && address) {
      try {
        // Calculate and log the batch ID for this transaction
        const calculatedBatchId = readBatchId(
          updatedConfig.swarmBatchNonce,
          GNOSIS_CUSTOM_REGISTRY_ADDRESS
        );

        // Also call createBatchId to set the state (fire and forget)
        createBatchId(
          updatedConfig.swarmBatchNonce,
          GNOSIS_CUSTOM_REGISTRY_ADDRESS,
          setPostageBatchId
        )
          .then(stateBasedBatchId => {
            console.log('State-based batch ID from createBatchId:', stateBasedBatchId);
          })
          .catch(error => {
            console.error('Error in createBatchId for state:', error);
          });
      } catch (error) {
        console.error('Failed to pre-calculate batch ID:', error);
      }
    }

    setIsLoading(true);
    setShowOverlay(true);
    setUploadStep('idle');
    setStatusMessage({
      step: 'Initialization',
      message: 'Preparing transaction...',
    });

    try {
      // Find the token in available tokens
      const selectedToken = availableTokens?.tokens[selectedChainId]?.find(token => {
        try {
          return toChecksumAddress(token.address) === toChecksumAddress(fromToken);
        } catch (error) {
          console.error('Error comparing token addresses:', error);
          return false;
        }
      });

      if (!selectedToken || !selectedToken.address) {
        throw new Error('Selected token not found');
      }

      setStatusMessage({
        step: 'Calculation',
        message: 'Calculating amounts...',
      });

      // Deciding if we are buying collection directly or swaping/bridging
      if (
        selectedChainId !== null &&
        selectedChainId === ChainId.DAI &&
        getAddress(fromToken) === getAddress(GNOSIS_BZZ_ADDRESS)
      ) {
        await handleDirectBzzTransactions(updatedConfig);
      } else {
        setStatusMessage({
          step: 'Quoting',
          message: 'Getting quote...',
        });

        const gnosisSourceToken =
          selectedChainId === ChainId.DAI ? fromToken : GNOSIS_DESTINATION_TOKEN;

        // Pass topUpBatchId to getGnosisQuote when doing a top-up
        const { gnosisContactCallsQuoteResponse, gnosisContractCallsRoute } =
          await performWithRetry(
            () =>
              getGnosisQuote({
                gnosisSourceToken,
                address,
                bzzAmount: updatedConfig.swarmBatchTotal,
                nodeAddress,
                swarmConfig: updatedConfig,
                setEstimatedTime,
                extendBatchId: isTopUp ? topUpBatchId || undefined : undefined, // Only pass if it's an extension
              }),
            'getGnosisQuote-execution',
            undefined,
            5, // 5 retries
            500 // 500ms delay between retries
          );

        // Check are we solving Gnosis chain or other chain Swap
        if (selectedChainId === ChainId.DAI) {
          await handleGnosisTokenSwap(gnosisContractCallsRoute, updatedConfig);
        } else {
          // This is gnosisSourceToken/gnosisDesatinationToken amount value
          const toAmount = gnosisContactCallsQuoteResponse.estimate.fromAmount;
          await handleCrossChainSwap(gnosisContractCallsRoute, toAmount, updatedConfig);
        }
      }
    } catch (error) {
      console.error('An error occurred:', error);
      setStatusMessage({
        step: 'Error',
        message: 'Execution failed',
        error: formatErrorMessage(error),
        isError: true,
      });
    }
  };

  const handleGetStarted = () => {
    if (openConnectModal) {
      openConnectModal();
    }
  };

  const saveUploadReference = (
    reference: string,
    postageBatchId: string,
    expiryDate: number,
    filename?: string
  ) => {
    if (!address) return;

    const savedHistory = localStorage.getItem('uploadHistory');
    const history = savedHistory ? JSON.parse(savedHistory) : {};

    const addressHistory = history[address] || [];
    addressHistory.unshift({
      reference,
      timestamp: Date.now(),
      filename,
      stampId: postageBatchId,
      expiryDate,
    });

    history[address] = addressHistory;
    localStorage.setItem('uploadHistory', JSON.stringify(history));
  };

  // Add new state for collection creation workflow
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionSymbol, setCollectionSymbol] = useState('');
  const [currentCollectionName, setCurrentCollectionName] = useState<string>(''); // For upload modal title
  const [pendingUploadData, setPendingUploadData] = useState<{
    reference: string;
    filename: string;
    stampId: string;
  } | null>(null);

  // New function to check if collection exists for stamp ID
  const checkCollectionExists = async (stampId: string): Promise<boolean> => {
    if (!publicClient) return false;

    try {
      // Check if contract exists for this stamp ID
      const [hasContract] = (await publicClient.readContract({
        address: BUZZMINT_FACTORY_ADDRESS,
        abi: BUZZMINT_FACTORY_ABI,
        functionName: 'hasContract',
        args: [stampId],
      })) as [boolean, string];

      return hasContract;
    } catch (error) {
      console.error('Error checking collection existence:', error);
      return false;
    }
  };

  // Helper function to fetch collection name for display
  const fetchCollectionNameForUpload = async (stampId: string) => {
    if (!publicClient) return;

    try {
      // Get NFT contract address for this stamp ID
      const nftContractAddress = await publicClient.readContract({
        address: BUZZMINT_FACTORY_ADDRESS,
        abi: BUZZMINT_FACTORY_ABI,
        functionName: 'getContractAddress',
        args: [stampId],
      });

      // Fetch collection name from the NFT contract
      const collectionNameForDisplay = (await publicClient.readContract({
        address: nftContractAddress as `0x${string}`,
        abi: BUZZMINT_COLLECTION_ABI,
        functionName: 'name',
      })) as string;

      setCurrentCollectionName(collectionNameForDisplay);
    } catch (error) {
      console.error('Error fetching collection name for upload:', error);
      setCurrentCollectionName('');
    }
  };

  // Modified upload function to handle collection workflow
  const handleFileUpload = async () => {
    if (!selectedFile || !postageBatchId || !walletClient || !publicClient) {
      console.error('Missing file, postage batch ID, or wallet');
      console.log('selectedFile', selectedFile);
      console.log('postageBatchId', postageBatchId);
      console.log('walletClient', walletClient);
      console.log('publicClient', publicClient);
      return;
    }

    // Check if collection exists and fetch name before starting upload
    const collectionExists = await checkCollectionExists(postageBatchId);
    if (collectionExists) {
      await fetchCollectionNameForUpload(postageBatchId);
    } else {
      setCurrentCollectionName(''); // Clear for new collections
    }

    setIsLoading(true);
    setShowOverlay(true);
    setUploadStep('uploading');

    try {
      // First upload the file to get the reference
      const reference = await uploadFile({
        selectedFile,
        postageBatchId,
        walletClient,
        publicClient,
        address,
        beeApiUrl,
        serveUncompressed,
        isTarFile,
        isWebpageUpload,
        setUploadProgress,
        setStatusMessage,
        setIsDistributing,
        setUploadStep,
        setSelectedDays,
        setShowOverlay,
        setIsLoading,
        setUploadStampInfo,
        saveUploadReference,
      });

      if (reference) {
        if (!collectionExists) {
          // First upload - show collection creation form
          setPendingUploadData({
            reference,
            filename: selectedFile.name,
            stampId: postageBatchId,
          });
          setShowCollectionForm(true);
          setUploadStep('idle');
          setIsLoading(false);
        } else {
          // Collection exists - check if this is the first NFT and proceed to minting
          const isFirst = await checkIfFirstNftUpload(postageBatchId);
          setIsFirstNftUpload(isFirst);
          await mintToExistingCollection(reference, selectedFile.name, postageBatchId);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setStatusMessage({
        step: 'Error',
        message: 'Upload failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        isError: true,
      });
      setUploadStep('idle');
      setUploadProgress(0);
      setIsDistributing(false);
    }
  };

  // Function to mint to existing collection
  const mintToExistingCollection = async (reference: string, filename: string, stampId: string) => {
    if (!walletClient || !publicClient) return;

    try {
      setStatusMessage({
        step: 'Minting',
        message: 'Minting NFT to existing collection...',
      });

      const dataURI = `https://bzz.link/bzz/${reference}`;

      // Get NFT contract address for this stamp ID
      const nftContractAddress = await publicClient.readContract({
        address: BUZZMINT_FACTORY_ADDRESS,
        abi: BUZZMINT_FACTORY_ABI,
        functionName: 'getContractAddress',
        args: [stampId],
      });

      // Get the next token ID that will be minted
      const nextTokenId = await publicClient.readContract({
        address: nftContractAddress as `0x${string}`,
        abi: BUZZMINT_COLLECTION_ABI,
        functionName: 'getNextTokenId',
      });

      // Call mintNFT function on factory contract
      const hash = await walletClient.writeContract({
        address: BUZZMINT_FACTORY_ADDRESS,
        abi: BUZZMINT_FACTORY_ABI,
        functionName: 'mintNFT',
        args: [stampId, filename, dataURI, '', ''], // Empty name/symbol for existing collection
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      setStatusMessage({
        step: 'Complete',
        message: 'NFT minted successfully!',
        isSuccess: true,
        reference,
        filename,
        transactionHash: hash,
        nftContractAddress: nftContractAddress as string,
        tokenId: Number(nextTokenId),
        stampId,
        dataURI,
        collectionName: currentCollectionName, // Use the fetched collection name
      });
      setUploadStep('complete');

      // Reset AI generation state
      setUploadMode('file');
      setAiPrompt('');
      setGeneratedImageUrl('');
      setIsGeneratingImage(false);
    } catch (error) {
      console.error('Minting error:', error);
      setStatusMessage({
        step: 'Error',
        message: 'Minting failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        isError: true,
      });
    }
  };

  // Function to create collection and mint first NFT
  const handleCollectionCreation = async () => {
    if (!pendingUploadData || !walletClient || !publicClient) return;

    try {
      setIsLoading(true);
      setShowCollectionForm(false);
      setShowOverlay(true);
      setUploadStep('uploading');

      setStatusMessage({
        step: 'Creating',
        message: 'Creating collection and minting first NFT...',
      });

      const { reference, filename, stampId } = pendingUploadData;
      const dataURI = `https://bzz.link/bzz/${reference}`;

      // Call createContractAndMint function on factory contract
      const hash = await walletClient.writeContract({
        address: BUZZMINT_FACTORY_ADDRESS,
        abi: BUZZMINT_FACTORY_ABI,
        functionName: 'createContractAndMint',
        args: [stampId, filename, dataURI, collectionName, collectionSymbol],
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Get the newly created NFT contract address
      const nftContractAddress = await publicClient.readContract({
        address: BUZZMINT_FACTORY_ADDRESS,
        abi: BUZZMINT_FACTORY_ABI,
        functionName: 'getContractAddress',
        args: [stampId],
      });

      setStatusMessage({
        step: 'Complete',
        message: 'NFT minted successfully!',
        isSuccess: true,
        reference,
        filename,
        transactionHash: hash,
        nftContractAddress: nftContractAddress as string,
        tokenId: 1, // First NFT is always token ID 1
        stampId,
        dataURI,
        collectionName,
      });
      setUploadStep('complete');

      // Reset form state
      setCollectionName('');
      setCollectionSymbol('');
      setPendingUploadData(null);

      // Reset AI generation state
      setUploadMode('file');
      setAiPrompt('');
      setGeneratedImageUrl('');
      setIsGeneratingImage(false);
    } catch (error) {
      console.error('Collection creation error:', error);
      setStatusMessage({
        step: 'Error',
        message: 'Collection creation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        isError: true,
      });
      setUploadStep('idle');
      setUploadProgress(0);
      setIsDistributing(false);
    }
  };

  const handleOpenDropdown = (dropdownName: string) => {
    setActiveDropdown(dropdownName);
  };

  // Reset insufficientFunds whenever the selected token changes
  useEffect(() => {
    // When token info changes, reset insufficient funds flag
    if (selectedTokenInfo) {
      setInsufficientFunds(false);
    }
  }, [selectedTokenInfo]);

  // Also reset insufficientFunds when the selectedChainId or selectedDays changes
  useEffect(() => {
    setInsufficientFunds(false);
  }, [selectedChainId, selectedDays]);

  // Add a new state variable to the component
  const [uploadStampInfo, setUploadStampInfo] = useState<StampInfo | null>(null);

  // Add this to the state variables near the beginning of the component
  const [originalStampInfo, setOriginalStampInfo] = useState<StampInfo | null>(null);

  // Add this effect to fetch stamp info when topUpBatchId is set
  useEffect(() => {
    // Only fetch if we have a topUpBatchId and we're in top-up mode
    if (topUpBatchId && isTopUp) {
      const getStampInfo = async () => {
        const stampInfo = await fetchStampInfo(topUpBatchId);
        if (stampInfo) {
          console.log('Fetched original stamp info:', stampInfo);
          setOriginalStampInfo(stampInfo);

          // Update the depth to match the original stamp
          setSelectedDepth(stampInfo.depth);

          // Lock the depth to the original value since we can't change it for top-ups
          setSwarmConfig(prev => ({
            ...prev,
            swarmBatchDepth: stampInfo.depth.toString(),
          }));
        }
      };

      getStampInfo();
    }
  }, [topUpBatchId, isTopUp, beeApiUrl]);

  // Modified URL parameter parsing to also check for hash fragments
  useEffect(() => {
    // Only run on client-side
    if (typeof window !== 'undefined') {
      // First check query parameters
      const url = new URL(window.location.href);
      const stampParam = url.searchParams.get('extend');

      // Then check hash fragments (e.g., #extend=batchId)
      const hash = window.location.hash;
      const hashMatch = hash.match(/^#extend=([a-fA-F0-9]+)$/);

      if (stampParam) {
        // Format with 0x prefix for contract call
        const formattedBatchId = stampParam.startsWith('0x') ? stampParam : `0x${stampParam}`;
        console.log(`Found stamp ID in URL query: ${formattedBatchId}`);
        setTopUpBatchId(formattedBatchId);
        setIsTopUp(true);
      } else if (hashMatch && hashMatch[1]) {
        // Format with 0x prefix for contract call
        const hashBatchId = hashMatch[1];
        const formattedBatchId = hashBatchId.startsWith('0x') ? hashBatchId : `0x${hashBatchId}`;
        console.log(`Found stamp ID in URL hash: ${formattedBatchId}`);
        setTopUpBatchId(formattedBatchId);
        setIsTopUp(true);
      }
    }
  }, []); // Only run once on mount

  // Function to fetch stamp information for a given batchId
  const fetchStampInfo = async (batchId: string): Promise<StampInfo | null> => {
    try {
      // Make sure the batchId doesn't have 0x prefix for the API call
      const formattedBatchId = batchId.startsWith('0x') ? batchId.slice(2) : batchId;

      const response = await fetch(`${beeApiUrl}/stamps/${formattedBatchId}`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.error(`Error fetching stamp info: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching stamp info for ${batchId}:`, error);
      return null;
    }
  };

  // Calculate amount for topping up an existing batch
  const calculateTopUpAmount = (originalDepth: number) => {
    if (currentPrice === null || !selectedDays) return 0n;

    // We use the original depth from the stamp, not the currently selected depth
    const initialPaymentPerChunkPerDay = BigInt(currentPrice) * BigInt(17280);
    const totalPricePerDuration = initialPaymentPerChunkPerDay * BigInt(selectedDays);

    // Calculate for the original batch depth
    return totalPricePerDuration * BigInt(2 ** originalDepth);
  };

  // Add useEffect to set hasMounted after component mounts
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Function to create collection after storage creation (without file upload)
  const handlePostStorageCollectionCreation = async () => {
    if (!createdStorageInfo || !walletClient || !publicClient) return;

    try {
      setIsLoading(true);
      setShowPostStorageCollectionForm(false);
      setShowOverlay(true);

      setStatusMessage({
        step: 'Creating',
        message: 'Creating NFT collection...',
      });

      const { batchId } = createdStorageInfo;

      // Remove 0x prefix for contract call
      const stampId = batchId.startsWith('0x') ? batchId.slice(2) : batchId;

      // Call createContract function on factory contract (without minting)
      const hash = await walletClient.writeContract({
        address: BUZZMINT_FACTORY_ADDRESS,
        abi: BUZZMINT_FACTORY_ABI,
        functionName: 'createContract',
        args: [stampId, collectionName, collectionSymbol],
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Get the newly created NFT contract address
      const nftContractAddress = await publicClient.readContract({
        address: BUZZMINT_FACTORY_ADDRESS,
        abi: BUZZMINT_FACTORY_ABI,
        functionName: 'getContractAddress',
        args: [stampId],
      });

      // Store collection info for next step
      setCreatedCollectionInfo({
        contractAddress: nftContractAddress as string,
        name: collectionName,
        symbol: collectionSymbol,
        stampId: batchId,
      });

      setStatusMessage({
        step: 'Complete',
        message:
          'NFT Collection Created Successfully! Now add your first image to this collection.',
        isSuccess: true,
        transactionHash: hash,
        nftContractAddress: nftContractAddress as string,
        collectionName,
        collectionSymbol,
        stampId: batchId,
      });

      // Reset form state
      setCollectionName('');
      setCollectionSymbol('');
      setCreatedStorageInfo(null);

      // After a brief delay, transition to upload mode but keep overlay open
      setTimeout(() => {
        // Start upload transition loading immediately
        setIsUploadTransitionLoading(true);

        // After another brief delay, show upload interface
        setTimeout(() => {
          setIsUploadTransitionLoading(false);
          setUploadStep('ready');
          // Set the postage batch ID for upload
          setPostageBatchId(stampId);
          // This is the first NFT upload for a new collection
          setIsFirstNftUpload(true);
          // Clear the success message and loading state
          setStatusMessage({ step: '', message: '' });
          setIsLoading(false);
          // Keep overlay open for upload (don't call setShowOverlay(false))
        }, 1500);
      }, 2000);
    } catch (error) {
      console.error('Collection creation error:', error);
      setStatusMessage({
        step: 'Error',
        message: 'Collection creation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to check if this is the first NFT upload
  const checkIfFirstNftUpload = async (stampId: string): Promise<boolean> => {
    if (!publicClient) return false;

    try {
      // Check if collection exists
      const collectionExists = await checkCollectionExists(stampId);
      if (!collectionExists) {
        return true; // No collection exists, so this would be first NFT
      }

      // Get NFT contract address
      const nftContractAddress = await publicClient.readContract({
        address: BUZZMINT_FACTORY_ADDRESS,
        abi: BUZZMINT_FACTORY_ABI,
        functionName: 'getContractAddress',
        args: [stampId],
      });

      // Get the next token ID
      const nextTokenId = await publicClient.readContract({
        address: nftContractAddress as `0x${string}`,
        abi: BUZZMINT_COLLECTION_ABI,
        functionName: 'getNextTokenId',
      });

      // If next token ID is 1, this will be the first NFT
      return Number(nextTokenId) === 1;
    } catch (error) {
      console.error('Error checking if first NFT upload:', error);
      // Default to false if we can't determine
      return false;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.betaBadge}>BETA</div>
      <div className={styles.tabContainer}>
        <button
          className={`${styles.tabButton} ${
            !showHelp && !showStampList && !showUploadHistory ? styles.activeTab : ''
          }`}
          onClick={() => {
            setShowHelp(false);
            setShowStampList(false);
            setShowUploadHistory(false);
          }}
        >
          {isTopUp ? 'Extend' : 'Buy'}
        </button>
        <button
          className={`${styles.tabButton} ${showStampList ? styles.activeTab : ''}`}
          onClick={() => {
            setShowHelp(false);
            setShowStampList(true);
            setShowUploadHistory(false);
          }}
        >
          Collections
        </button>
        <button
          className={`${styles.tabButton} ${showUploadHistory ? styles.activeTab : ''}`}
          onClick={() => {
            setShowHelp(false);
            setShowStampList(false);
            setShowUploadHistory(true);
          }}
        >
          Minted
        </button>
        <button
          className={`${styles.tabButton} ${showHelp ? styles.activeTab : ''}`}
          onClick={() => {
            setShowHelp(true);
            setShowStampList(false);
            setShowUploadHistory(false);
          }}
          aria-label="Settings"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>

      {!showHelp && !showStampList && !showUploadHistory ? (
        <>
          <div className={styles.inputGroup}>
            <label className={styles.label} data-tooltip="Select chain with funds">
              From chain
            </label>
            <SearchableChainDropdown
              selectedChainId={selectedChainId || ChainId.DAI}
              availableChains={availableChains}
              onChainSelect={chainId => {
                setSelectedChainId(chainId);
                switchChain?.({ chainId });
              }}
              isChainsLoading={isChainsLoading}
              isLoading={isChainsLoading}
              activeDropdown={activeDropdown}
              onOpenDropdown={handleOpenDropdown}
              sortMethod="priority"
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} data-tooltip="Select token you want to spend">
              From token
            </label>
            <SearchableTokenDropdown
              fromToken={fromToken}
              selectedChainId={selectedChainId || ChainId.DAI}
              isWalletLoading={isWalletLoading}
              isTokensLoading={isTokensLoading}
              isConnected={isConnected}
              tokenBalances={tokenBalances}
              selectedTokenInfo={selectedTokenInfo}
              availableTokens={availableTokens}
              onTokenSelect={(address, token) => {
                console.log('Token manually selected:', address, token?.symbol);

                // Only reset duration if this is a user-initiated token change (not during initial loading)
                if (fromToken && address !== fromToken) {
                  console.log('Resetting duration due to token change');
                  setSelectedDays(null);
                  setTotalUsdAmount(null);
                  setInsufficientFunds(false);
                  setLiquidityError(false);
                  setIsPriceEstimating(false);
                }

                setFromToken(address);
                setSelectedTokenInfo(token);
              }}
              minBalanceUsd={MIN_TOKEN_BALANCE_USD}
              activeDropdown={activeDropdown}
              onOpenDropdown={handleOpenDropdown}
            />
          </div>

          {!isTopUp && (
            <div className={styles.inputGroup}>
              <label
                className={styles.label}
                data-tooltip="Storage collections are used to pay to store and host data in Swarm"
              >
                Storage size
              </label>
              <div className={styles.sizeButtonGroup}>
                {STORAGE_OPTIONS.map(({ depth, size, description }) => (
                  <button
                    key={depth}
                    type="button"
                    className={`${styles.sizeButton} ${
                      selectedDepth === depth ? styles.selected : ''
                    }`}
                    onClick={() => handleDepthChange(depth)}
                  >
                    <span className={styles.sizeButtonTitle}>{size}</span>
                    <span className={styles.sizeButtonSize}>{description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.inputGroup}>
            <label
              className={styles.label}
              data-tooltip="Duration of storage collections for which you are paying for"
            >
              {isTopUp ? 'Extension duration' : 'Storage duration'}
            </label>
            <div className={styles.buttonGroup}>
              {TIME_OPTIONS.map(option => (
                <button
                  key={option.days}
                  type="button"
                  className={`${styles.optionButton} ${
                    selectedDays === option.days ? styles.selected : ''
                  }`}
                  onClick={() => setSelectedDays(option.days)}
                >
                  {option.display}
                </button>
              ))}
            </div>
          </div>

          {selectedDays && totalUsdAmount !== null && Number(totalUsdAmount) !== 0 && (
            <p className={styles.priceInfo}>
              {liquidityError
                ? 'Not enough liquidity for this swap'
                : insufficientFunds
                  ? `Cost ($${Number(totalUsdAmount).toFixed(2)}) exceeds your balance`
                  : `Cost without gas ~ $${Number(totalUsdAmount).toFixed(2)}`}
            </p>
          )}

          <button
            className={`${styles.button} ${
              !hasMounted || !isConnected
                ? ''
                : !selectedDays || !fromToken || liquidityError || insufficientFunds
                  ? styles.buttonDisabled
                  : ''
            } ${isPriceEstimating ? styles.calculatingButton : ''}`}
            disabled={
              isConnected &&
              hasMounted &&
              (!selectedDays ||
                !fromToken ||
                liquidityError ||
                insufficientFunds ||
                isPriceEstimating)
            }
            onClick={!hasMounted || !isConnected ? handleGetStarted : handleSwap}
          >
            {isLoading ? (
              <div>Loading...</div>
            ) : !hasMounted || !isConnected ? (
              'Get Started'
            ) : !selectedDays ? (
              'Choose Timespan'
            ) : !fromToken ? (
              'No Token Available'
            ) : isPriceEstimating ? (
              'Calculating Cost...'
            ) : liquidityError ? (
              "Cannot Swap - Can't Find Route"
            ) : insufficientFunds ? (
              'Insufficient Balance'
            ) : isTopUp ? (
              'Extend Collection'
            ) : (
              'Buy Storage'
            )}
          </button>

          {executionResult && (
            <pre className={styles.resultBox}>{JSON.stringify(executionResult, null, 2)}</pre>
          )}

          {(isLoading || (showOverlay && uploadStep !== 'idle')) && (
            <div className={styles.overlay}>
              <div
                className={`${styles.statusBox} ${statusMessage.isSuccess ? styles.success : ''}`}
              >
                {/* Always show close button */}
                <button
                  className={styles.closeButton}
                  onClick={() => {
                    setShowOverlay(false);
                    setStatusMessage({ step: '', message: '' });
                    setUploadStep('idle');
                    setIsLoading(false);
                    setExecutionResult(null);
                    setSelectedFile(null);
                    setIsWebpageUpload(false);
                    setIsTarFile(false);
                    setIsDistributing(false);
                  }}
                >
                  ×
                </button>

                {!['ready', 'uploading'].includes(uploadStep) && (
                  <>
                    {isLoading && statusMessage.step !== 'Complete' && (
                      <div className={styles.spinner}></div>
                    )}
                    <div className={styles.statusMessage}>
                      {/* Remove the duplicate h3 title here since we have it in the success message section */}
                      {!statusMessage.isSuccess && (
                        <h3 className={statusMessage.isSuccess ? styles.success : ''}>
                          {statusMessage.message}
                        </h3>
                      )}
                      {statusMessage.error && (
                        <div className={styles.errorMessage}>{statusMessage.error}</div>
                      )}

                      {remainingTime !== null &&
                        estimatedTime !== null &&
                        statusMessage.step === 'Route' && (
                          <div className={styles.bridgeTimer}>
                            <p>Estimated time remaining: {formatTime(remainingTime)}</p>
                            <div className={styles.progressBarContainer}>
                              <div
                                className={styles.progressBar}
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(100, (1 - remainingTime / estimatedTime) * 100)
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  </>
                )}

                {['ready', 'uploading'].includes(uploadStep) && (
                  <div className={styles.uploadBox}>
                    <h3 className={styles.uploadTitle}>
                      {currentCollectionName
                        ? `Upload to ${currentCollectionName}`
                        : postageBatchId
                          ? `Upload to ${
                              postageBatchId.startsWith('0x')
                                ? postageBatchId.slice(2, 8)
                                : postageBatchId.slice(0, 6)
                            }...${postageBatchId.slice(-4)}`
                          : 'Upload File'}
                    </h3>
                    {currentCollectionName && postageBatchId && (
                      <div className={styles.uploadSubtitle}>
                        Collection ID:{' '}
                        {postageBatchId.startsWith('0x')
                          ? postageBatchId.slice(2, 8)
                          : postageBatchId.slice(0, 6)}
                        ...{postageBatchId.slice(-4)}
                      </div>
                    )}
                    {isFirstNftUpload && (
                      <div className={styles.uploadWarning}>
                        Warning: Upload of first NFT may take longer as storage creation might still
                        be propagating.
                      </div>
                    )}
                    {statusMessage.step === 'waiting_creation' ||
                    statusMessage.step === 'waiting_usable' ? (
                      <div className={styles.waitingMessage}>
                        <div className={styles.spinner}></div>
                        <p>{statusMessage.message}</p>
                      </div>
                    ) : (
                      <div className={styles.uploadForm}>
                        {/* Upload Mode Toggle */}
                        <div className={styles.uploadModeToggle}>
                          <button
                            className={`${styles.modeButton} ${uploadMode === 'file' ? styles.active : ''}`}
                            onClick={() => {
                              setUploadMode('file');
                              setAiPrompt('');
                              setGeneratedImageUrl('');
                            }}
                            disabled={uploadStep === 'uploading' || isGeneratingImage}
                          >
                            📁 Upload File
                          </button>
                          <button
                            className={`${styles.modeButton} ${uploadMode === 'ai' ? styles.active : ''}`}
                            onClick={() => {
                              setUploadMode('ai');
                              setSelectedFile(null);
                            }}
                            disabled={
                              uploadStep === 'uploading' || isGeneratingImage || !openAiApiKey
                            }
                            title={
                              !openAiApiKey ? 'Configure OpenAI API key in Settings first' : ''
                            }
                          >
                            🎨 Generate with AI
                          </button>
                        </div>

                        {uploadMode === 'file' ? (
                          /* File Upload Mode */
                          <div className={styles.fileUploadSection}>
                            <div className={styles.fileInputWrapper}>
                              <input
                                type="file"
                                onChange={e => {
                                  const file = e.target.files?.[0] || null;
                                  setSelectedFile(file);
                                  setIsTarFile(
                                    file?.name.toLowerCase().endsWith('.tar') ||
                                      file?.name.toLowerCase().endsWith('.zip') ||
                                      file?.name.toLowerCase().endsWith('.gz') ||
                                      false
                                  );
                                  setGeneratedImageUrl(''); // Clear any generated image
                                }}
                                className={styles.fileInput}
                                disabled={uploadStep === 'uploading'}
                                id="file-upload"
                              />
                              <label htmlFor="file-upload" className={styles.fileInputLabel}>
                                {selectedFile ? selectedFile.name : 'Choose file'}
                              </label>
                            </div>

                            {(selectedFile?.name.toLowerCase().endsWith('.zip') ||
                              selectedFile?.name.toLowerCase().endsWith('.gz')) && (
                              <div className={styles.checkboxWrapper}>
                                <input
                                  type="checkbox"
                                  id="serve-uncompressed"
                                  checked={serveUncompressed}
                                  onChange={e => setServeUncompressed(e.target.checked)}
                                  className={styles.checkbox}
                                  disabled={uploadStep === 'uploading'}
                                />
                                <label
                                  htmlFor="serve-uncompressed"
                                  className={styles.checkboxLabel}
                                >
                                  Serve uncompressed
                                </label>
                              </div>
                            )}

                            {isTarFile && (
                              <div className={styles.checkboxWrapper}>
                                <input
                                  type="checkbox"
                                  id="webpage-upload"
                                  checked={isWebpageUpload}
                                  onChange={e => setIsWebpageUpload(e.target.checked)}
                                  className={styles.checkbox}
                                  disabled={uploadStep === 'uploading'}
                                />
                                <label htmlFor="webpage-upload" className={styles.checkboxLabel}>
                                  Upload as webpage
                                </label>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* AI Generation Mode */
                          <div className={styles.aiGenerationSection}>
                            <div className={styles.promptInputWrapper}>
                              <textarea
                                value={aiPrompt}
                                onChange={e => setAiPrompt(e.target.value)}
                                placeholder="Describe the image you want to generate..."
                                className={styles.promptInput}
                                disabled={isGeneratingImage || uploadStep === 'uploading'}
                                rows={3}
                              />
                            </div>

                            {generatedImageUrl && (
                              <div className={styles.generatedImagePreview}>
                                <img
                                  src={generatedImageUrl}
                                  alt="Generated image"
                                  className={styles.generatedImage}
                                />
                                <p className={styles.generatedImageLabel}>
                                  Generated Image Ready for Upload
                                </p>
                              </div>
                            )}

                            <button
                              onClick={handleAiGeneration}
                              disabled={
                                !aiPrompt.trim() ||
                                isGeneratingImage ||
                                uploadStep === 'uploading' ||
                                !openAiApiKey
                              }
                              className={`${styles.generateButton} ${isGeneratingImage ? styles.generating : ''}`}
                            >
                              {isGeneratingImage ? (
                                <>
                                  <div className={styles.smallSpinner}></div>
                                  Generating...
                                </>
                              ) : (
                                '✨ Generate Image'
                              )}
                            </button>
                          </div>
                        )}

                        <button
                          onClick={handleFileUpload}
                          disabled={!selectedFile || uploadStep === 'uploading'}
                          className={styles.uploadButton}
                        >
                          {uploadStep === 'uploading' ? (
                            <>
                              <div className={styles.smallSpinner}></div>
                              {statusMessage.step === '404'
                                ? 'Searching for collection ID...'
                                : statusMessage.step === '422'
                                  ? 'Waiting for batch to be usable...'
                                  : statusMessage.step === 'Uploading'
                                    ? isDistributing
                                      ? 'Distributing file chunks...'
                                      : `Uploading... ${uploadProgress.toFixed(1)}%`
                                    : 'Processing...'}
                            </>
                          ) : uploadMode === 'ai' && generatedImageUrl ? (
                            'Upload Generated Image'
                          ) : (
                            'Upload'
                          )}
                        </button>
                        {uploadStep === 'uploading' && (
                          <>
                            {!isDistributing ? (
                              // Show the regular progress bar during upload
                              <div className={styles.progressBarContainer}>
                                <div
                                  className={styles.progressBar}
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                            ) : (
                              // Show the particle swarm network animation when distributing to Swarm
                              <div className={styles.distributionContainer}>
                                {/* Central file node */}
                                <div className={styles.centerNode}></div>

                                {/* Network particles flying out */}
                                <div className={`${styles.particle} ${styles.particle1}`}></div>
                                <div className={`${styles.particle} ${styles.particle2}`}></div>
                                <div className={`${styles.particle} ${styles.particle3}`}></div>
                                <div className={`${styles.particle} ${styles.particle4}`}></div>
                                <div className={`${styles.particle} ${styles.particle5}`}></div>
                                <div className={`${styles.particle} ${styles.particle6}`}></div>

                                {/* Connection lines between particles */}
                                <div
                                  className={`${styles.connectionLine} ${styles.connection1}`}
                                ></div>
                                <div
                                  className={`${styles.connectionLine} ${styles.connection2}`}
                                ></div>
                                <div
                                  className={`${styles.connectionLine} ${styles.connection3}`}
                                ></div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {uploadStep === 'complete' && (
                  <div className={styles.successMessage}>
                    <div className={styles.successIcon}>✓</div>
                    <h3>NFT Minted Successfully!</h3>

                    {/* Image Preview */}
                    {statusMessage.dataURI && (
                      <div className={styles.imagePreview}>
                        <img
                          src={statusMessage.dataURI}
                          alt={statusMessage.filename || 'Uploaded file'}
                          className={styles.previewImage}
                          onError={e => {
                            // Hide image if it fails to load
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* File and Collection Info */}
                    <div className={styles.nftDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>File:</span>
                        <span className={styles.detailValue}>
                          {statusMessage.filename}
                          {statusMessage.filename?.includes('ai-generated') && (
                            <span className={styles.aiGeneratedBadge}> ✨ AI Generated</span>
                          )}
                        </span>
                      </div>

                      {statusMessage.collectionName && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Collection:</span>
                          <span className={styles.detailValue}>{statusMessage.collectionName}</span>
                        </div>
                      )}

                      {statusMessage.nftContractAddress && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>NFT Contract:</span>
                          <a
                            href={`https://gnosis.blockscout.com/address/${statusMessage.nftContractAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.contractLink}
                          >
                            {statusMessage.nftContractAddress.slice(0, 6)}...
                            {statusMessage.nftContractAddress.slice(-4)}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Action Links */}
                    <div className={styles.actionLinks}>
                      {statusMessage.transactionHash && (
                        <a
                          href={
                            statusMessage.nftContractAddress && statusMessage.tokenId
                              ? `https://gnosis.blockscout.com/token/${statusMessage.nftContractAddress}/instance/${statusMessage.tokenId}`
                              : `https://gnosis.blockscout.com/tx/${statusMessage.transactionHash}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.scanLink}
                        >
                          {statusMessage.nftContractAddress && statusMessage.tokenId
                            ? 'View NFT'
                            : 'Chain Link'}
                        </a>
                      )}

                      {statusMessage.dataURI && (
                        <a
                          href={statusMessage.dataURI}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.viewLink}
                        >
                          View File
                        </a>
                      )}
                    </div>

                    {/* Storage Collection Details */}
                    {uploadStampInfo && (
                      <div className={styles.stampInfoBox}>
                        <h4>Storage Collection Details</h4>
                        <div className={styles.stampDetails}>
                          <div className={styles.stampDetail}>
                            <span>Size:</span>
                            <span className={styles.sizeValue}>
                              {uploadStampInfo.depth === 19
                                ? '~100 MB'
                                : uploadStampInfo.depth === 20
                                  ? '~600 MB'
                                  : uploadStampInfo.depth === 21
                                    ? '~2 GB'
                                    : uploadStampInfo.totalSize}
                            </span>
                          </div>
                          <div className={styles.stampDetail}>
                            <span>Used:</span>
                            <span className={styles.utilizationValue}>
                              {uploadStampInfo.utilizationPercent?.toFixed(2)}%
                            </span>
                          </div>
                          <div className={styles.stampDetail}>
                            <span>Expires in:</span>
                            <span className={styles.expiryValue}>
                              {Math.floor((uploadStampInfo.batchTTL || 0) / 86400)} days
                            </span>
                          </div>
                        </div>

                        {/* Utilization Bar */}
                        <div className={styles.utilizationBarContainer}>
                          <div
                            className={styles.utilizationBar}
                            style={{ width: `${uploadStampInfo.utilizationPercent || 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      className={styles.closeSuccessButton}
                      onClick={() => {
                        setShowOverlay(false);
                        setUploadStep('idle');
                        setStatusMessage({ step: '', message: '' });
                        setIsLoading(false);
                        setExecutionResult(null);
                        setSelectedFile(null);
                        setIsWebpageUpload(false);
                        setIsTarFile(false);
                        setIsDistributing(false);
                        setUploadStampInfo(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}

                {topUpCompleted && (
                  <div className={styles.successMessage}>
                    <div className={styles.successIcon}>✓</div>
                    <h3>Collection Extended Successfully!</h3>
                    <div className={styles.referenceBox}>
                      <p>Collection ID:</p>
                      <div className={styles.referenceCopyWrapper}>
                        <code
                          className={styles.referenceCode}
                          onClick={() => {
                            navigator.clipboard.writeText(topUpInfo?.batchId || '');
                            // Show a temporary "Copied!" message
                            const codeEl = document.querySelector(`.${styles.referenceCode}`);
                            if (codeEl) {
                              codeEl.setAttribute('data-copied', 'true');
                              setTimeout(() => {
                                codeEl.setAttribute('data-copied', 'false');
                              }, 2000);
                            }
                          }}
                          data-copied="false"
                        >
                          {topUpInfo?.batchId}
                        </code>
                      </div>
                    </div>

                    <div className={styles.stampInfoBox}>
                      <h4>Extension Details</h4>
                      <div className={styles.stampDetails}>
                        <div className={styles.stampDetail}>
                          <span>Added Duration:</span>
                          <span>{topUpInfo?.days} days</span>
                        </div>
                        <div className={styles.stampDetail}>
                          <span>Cost:</span>
                          <span>${Number(topUpInfo?.cost || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      className={styles.closeSuccessButton}
                      onClick={() => {
                        setShowOverlay(false);
                        setTopUpCompleted(false);
                        setTopUpInfo(null);
                        setStatusMessage({ step: '', message: '' });
                        setIsLoading(false);
                        setExecutionResult(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : showHelp ? (
        <HelpSection
          nodeAddress={nodeAddress}
          openAiApiKey={openAiApiKey}
          onOpenAiKeyChange={handleOpenAiKeyChange}
        />
      ) : showStampList ? (
        <StampListSection
          setShowStampList={setShowStampList}
          address={address}
          beeApiUrl={beeApiUrl}
          setPostageBatchId={setPostageBatchId}
          setShowOverlay={setShowOverlay}
          setUploadStep={setUploadStep}
          checkIfFirstNftUpload={checkIfFirstNftUpload}
          setIsFirstNftUpload={setIsFirstNftUpload}
          setCurrentCollectionName={setCurrentCollectionName}
        />
      ) : showUploadHistory ? (
        <UploadHistorySection address={address} setShowUploadHistory={setShowUploadHistory} />
      ) : null}

      {/* Collection Creation Form Modal */}
      {showCollectionForm && (
        <div className={styles.overlay}>
          <div className={styles.statusBox}>
            <button
              className={styles.closeButton}
              onClick={() => {
                setShowCollectionForm(false);
                setPendingUploadData(null);
                setCollectionName('');
                setCollectionSymbol('');
              }}
            >
              ×
            </button>

            <h3 className={styles.uploadTitle}>Create NFT Collection</h3>
            <p className={styles.collectionDescription}>
              This is your first upload to this storage collection. Please provide a name and symbol
              for your NFT collection:
            </p>

            <div className={styles.collectionForm}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Collection Name *</label>
                <input
                  type="text"
                  value={collectionName}
                  onChange={e => setCollectionName(e.target.value)}
                  placeholder="e.g., My AI Art Collection"
                  className={styles.input}
                  maxLength={50}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Collection Symbol *</label>
                <input
                  type="text"
                  value={collectionSymbol}
                  onChange={e => setCollectionSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g., MYART"
                  className={styles.input}
                  maxLength={10}
                  required
                />
              </div>

              <div className={styles.collectionInfo}>
                <p>
                  <strong>File:</strong> {pendingUploadData?.filename}
                </p>
                <p>
                  <strong>Storage ID:</strong> {pendingUploadData?.stampId?.slice(0, 8)}...
                  {pendingUploadData?.stampId?.slice(-4)}
                </p>
                <p>
                  <strong>Data URI:</strong> https://bzz.link/bzz/{pendingUploadData?.reference}
                </p>
              </div>

              <div className={styles.buttonGroup}>
                <button
                  onClick={handleCollectionCreation}
                  disabled={!collectionName.trim() || !collectionSymbol.trim()}
                  className={`${styles.button} ${!collectionName.trim() || !collectionSymbol.trim() ? styles.buttonDisabled : ''}`}
                >
                  Create Collection & Mint NFT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post-Storage Collection Creation Form Modal */}
      {showPostStorageCollectionForm && (
        <div className={styles.overlay}>
          <div className={`${styles.statusBox} ${styles.largeStatusBox}`}>
            <button
              className={styles.closeButton}
              onClick={() => {
                setShowPostStorageCollectionForm(false);
                setCreatedStorageInfo(null);
                setCollectionName('');
                setCollectionSymbol('');
              }}
            >
              ×
            </button>

            <h3 className={styles.uploadTitle}>Create Your NFT Collection</h3>
            <p className={styles.collectionDescription}>
              Great! Your storage is ready. Now please provide a name and symbol for your NFT
              collection:
            </p>

            <div className={styles.collectionForm}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Collection Name *</label>
                <input
                  type="text"
                  value={collectionName}
                  onChange={e => setCollectionName(e.target.value)}
                  placeholder="e.g., My AI Art Collection"
                  className={styles.input}
                  maxLength={50}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Collection Symbol *</label>
                <input
                  type="text"
                  value={collectionSymbol}
                  onChange={e => setCollectionSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g., MYART"
                  className={styles.input}
                  maxLength={10}
                  required
                />
              </div>

              <div className={styles.collectionInfo}>
                <p>
                  <strong>Storage ID:</strong> {createdStorageInfo?.batchId?.slice(0, 8)}...
                  {createdStorageInfo?.batchId?.slice(-4)}
                </p>
                <p>
                  <strong>Storage Duration:</strong> {createdStorageInfo?.days} days
                </p>
                <p>
                  <strong>Storage Cost:</strong> ${Number(createdStorageInfo?.cost || 0).toFixed(2)}
                </p>
              </div>

              <div className={styles.buttonGroup}>
                <button
                  onClick={handlePostStorageCollectionCreation}
                  disabled={!collectionName.trim() || !collectionSymbol.trim()}
                  className={`${styles.button} ${!collectionName.trim() || !collectionSymbol.trim() ? styles.buttonDisabled : ''}`}
                >
                  Create NFT Collection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transition Loading Overlay */}
      {isTransitionLoading && (
        <div className={styles.overlay}>
          <div className={`${styles.statusBox} ${styles.largeStatusBox}`}>
            <div className={styles.transitionLoading}>
              <div className={styles.spinner}></div>
              <h3 className={styles.transitionTitle}>Preparing Your NFT Collection</h3>
              <p className={styles.transitionMessage}>
                Your storage is ready! Setting up the collection creation form...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Transition Loading Overlay */}
      {isUploadTransitionLoading && (
        <div className={styles.overlay}>
          <div className={`${styles.statusBox} ${styles.largeStatusBox}`}>
            <div className={styles.transitionLoading}>
              <div className={styles.spinner}></div>
              <h3 className={styles.transitionTitle}>Preparing for Upload</h3>
              <p className={styles.transitionMessage}>
                Your NFT collection is ready! Setting up the upload interface...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwapComponent;
