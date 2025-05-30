import { run } from 'hardhat';

async function main() {
  console.log('Starting contract verification on Blockscout...');

  // BuzzMintCollectionFactory - no constructor arguments
  const factoryAddress = '0xEEF13Ef9eD9cDD169701eeF3cd832df298dD1bB4';

  try {
    console.log(`Verifying BuzzMintCollectionFactory at ${factoryAddress}...`);

    await run('verify:verify', {
      address: factoryAddress,
      constructorArguments: [], // No constructor arguments for the factory
      network: 'gnosis',
    });

    console.log('✅ BuzzMintCollectionFactory verified successfully!');
    console.log(
      `🔗 View on Blockscout: https://gnosis.blockscout.com/address/${factoryAddress}#code`
    );
  } catch (error: any) {
    if (error.message.includes('already verified')) {
      console.log('✅ Contract is already verified on Blockscout');
      console.log(
        `🔗 View on Blockscout: https://gnosis.blockscout.com/address/${factoryAddress}#code`
      );
    } else {
      console.error('❌ Verification failed:', error.message);
    }
  }
}

// Function to verify a specific BuzzMintCollection contract
export async function verifyCollection(
  contractAddress: string,
  stampId: string,
  name: string,
  symbol: string,
  factoryAddress: string
) {
  try {
    console.log(`Verifying BuzzMintCollection at ${contractAddress}...`);

    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: [stampId, name, symbol, factoryAddress],
      contract: 'contracts/BuzzMintCollection.sol:BuzzMintCollection',
      network: 'gnosis',
    });

    console.log('✅ BuzzMintCollection verified successfully!');
    console.log(
      `🔗 View on Blockscout: https://gnosis.blockscout.com/address/${contractAddress}#code`
    );
  } catch (error: any) {
    if (error.message.includes('already verified')) {
      console.log('✅ Contract is already verified on Blockscout');
      console.log(
        `🔗 View on Blockscout: https://gnosis.blockscout.com/address/${contractAddress}#code`
      );
    } else {
      console.error('❌ Verification failed:', error.message);
      throw error;
    }
  }
}

// Run the main verification if this script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
