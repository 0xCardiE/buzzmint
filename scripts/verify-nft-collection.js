const { createPublicClient, http } = require('viem');
const { gnosis } = require('viem/chains');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

async function verifyNFTCollection(contractAddress) {
  if (!contractAddress) {
    console.error('❌ Please provide a contract address');
    console.log('Usage: node scripts/verify-nft-collection.js <contract-address>');
    process.exit(1);
  }

  console.log(`🔍 Verifying NFT Collection contract: ${contractAddress}`);

  // Create a client to interact with Gnosis chain
  const client = createPublicClient({
    chain: gnosis,
    transport: http(),
  });

  try {
    console.log('📡 Reading contract information...');

    // Try to read the contract's basic info
    const [name, symbol, owner, stampId] = await Promise.all([
      client.readContract({
        address: contractAddress,
        abi: [
          {
            inputs: [],
            name: 'name',
            outputs: [{ internalType: 'string', name: '', type: 'string' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'name',
      }),
      client.readContract({
        address: contractAddress,
        abi: [
          {
            inputs: [],
            name: 'symbol',
            outputs: [{ internalType: 'string', name: '', type: 'string' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'symbol',
      }),
      client.readContract({
        address: contractAddress,
        abi: [
          {
            inputs: [],
            name: 'owner',
            outputs: [{ internalType: 'address', name: '', type: 'address' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'owner',
      }),
      client.readContract({
        address: contractAddress,
        abi: [
          {
            inputs: [],
            name: 'stampId',
            outputs: [{ internalType: 'string', name: '', type: 'string' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'stampId',
      }),
    ]);

    console.log('\n📋 Contract Information:');
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Owner: ${owner}`);
    console.log(`Stamp ID: ${stampId}`);

    console.log('\n🔧 Attempting verification...');

    // Build the verification command
    const verifyCommand = `npx hardhat verify --network gnosis ${contractAddress} "${name}" "${symbol}" "${owner}" "${stampId}"`;

    try {
      const { stdout, stderr } = await execPromise(verifyCommand);

      if (stdout.includes('Successfully verified') || stderr.includes('already been verified')) {
        console.log('✅ Contract verified successfully!');
        console.log(`🔗 Blockscout: https://gnosis.blockscout.com/address/${contractAddress}#code`);
        console.log(`🔗 GnosisScan: https://gnosisscan.io/address/${contractAddress}#code`);
      } else {
        console.log('📝 Verification output:', stdout);
        if (stderr) console.log('⚠️  Stderr:', stderr);
      }
    } catch (verifyError) {
      if (
        verifyError.message.includes('already been verified') ||
        verifyError.stdout?.includes('already been verified')
      ) {
        console.log('✅ Contract is already verified!');
        console.log(`🔗 Blockscout: https://gnosis.blockscout.com/address/${contractAddress}#code`);
        console.log(`🔗 GnosisScan: https://gnosisscan.io/address/${contractAddress}#code`);
      } else {
        console.error('❌ Verification failed:', verifyError.message);
        console.log('\n📝 Manual verification command:');
        console.log(verifyCommand);
      }
    }
  } catch (error) {
    console.error('❌ Error reading contract information:', error.message);
    console.log('\nMake sure:');
    console.log('1. The contract address is correct');
    console.log('2. The contract is deployed on Gnosis chain');
    console.log('3. The contract is a BuzzMint NFT collection');
  }
}

// Get contract address from command line arguments
const contractAddress = process.argv[2];

verifyNFTCollection(contractAddress)
  .then(() => {
    console.log('\n🎉 Verification process completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
