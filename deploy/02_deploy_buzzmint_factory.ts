import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log('----------------------------------------------------');
  log('Deploying BuzzMintCollectionFactory and waiting for confirmations...');

  // Deploy the BuzzMintCollectionFactory contract
  const buzzMintFactory = await deploy('BuzzMintCollectionFactory', {
    from: deployer,
    args: [], // No constructor arguments needed
    log: true,
    // If we're on a local network, we don't need to wait for confirmations
    waitConfirmations: network.name === 'hardhat' ? 1 : 5,
  });

  log(`BuzzMintCollectionFactory deployed at ${buzzMintFactory.address}`);

  // Verify the contract on both Etherscan and Blockscout if we're not on a local network
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    log('----------------------------------------------------');
    log('Starting contract verification on multiple explorers...');

    // Wait a bit for the contract to be indexed
    log('Waiting 30 seconds for contract to be indexed...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    const verificationArgs = {
      address: buzzMintFactory.address,
      constructorArguments: [],
      contract: 'contracts/BuzzMintCollectionFactory.sol:BuzzMintCollectionFactory',
    };

    // 1. Verify on Blockscout (primary)
    log('🔍 Verifying on Blockscout...');
    try {
      await hre.run('verify:verify', verificationArgs);
      log('✅ Contract verified successfully on Blockscout!');

      if (network.name === 'gnosis') {
        log(`🔗 Blockscout: https://gnosis.blockscout.com/address/${buzzMintFactory.address}#code`);
      }
    } catch (error: any) {
      if (error.message.includes('already verified')) {
        log('✅ Contract is already verified on Blockscout');
        if (network.name === 'gnosis') {
          log(
            `🔗 Blockscout: https://gnosis.blockscout.com/address/${buzzMintFactory.address}#code`
          );
        }
      } else {
        log('❌ Blockscout verification failed:', error.message);
      }
    }

    // 2. Verify on Etherscan (GnosisScan) if API key is available
    if (network.name === 'gnosis' && process.env.MAINNET_ETHERSCAN_KEY) {
      log('🔍 Verifying on Etherscan (GnosisScan)...');
      try {
        // Use a separate verification call for GnosisScan with explicit network
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

        const gnosisScanCommand = `npx hardhat verify --network gnosisscan ${buzzMintFactory.address}`;
        await execPromise(gnosisScanCommand);

        log('✅ Contract verified successfully on GnosisScan!');
        log(`🔗 GnosisScan: https://gnosisscan.io/address/${buzzMintFactory.address}#code`);
      } catch (error: any) {
        if (
          error.message.includes('already verified') ||
          error.stdout?.includes('already verified')
        ) {
          log('✅ Contract is already verified on GnosisScan');
          log(`🔗 GnosisScan: https://gnosisscan.io/address/${buzzMintFactory.address}#code`);
        } else {
          log('❌ GnosisScan verification failed:', error.message);
          log('Note: Ensure MAINNET_ETHERSCAN_KEY is set in your .env file');
        }
      }
    } else if (network.name === 'gnosis') {
      log('⚠️  Skipping GnosisScan verification - MAINNET_ETHERSCAN_KEY not found in .env');
    }

    log('----------------------------------------------------');
    log('📋 Manual verification commands (if needed):');
    log(`Blockscout: npm run verify:factory`);
    log(`GnosisScan: npx hardhat verify --network gnosis ${buzzMintFactory.address}`);
  }

  // Log deployment information for easy access
  log('----------------------------------------------------');
  log('🎉 BuzzMint Factory Deployment Summary:');
  log(`Network: ${network.name}`);
  log(`Deployer: ${deployer}`);
  log(`Factory Address: ${buzzMintFactory.address}`);

  if (network.name === 'gnosis') {
    log(`Blockscout: https://gnosis.blockscout.com/address/${buzzMintFactory.address}`);
    log(`GnosisScan: https://gnosisscan.io/address/${buzzMintFactory.address}`);
  }

  log('----------------------------------------------------');
  log('📝 Next Steps:');
  log('1. Update frontend constants with the factory address');
  log('2. Test contract deployment with a sample NFT mint');
  log('3. Verify individual collection contracts as they are created');
  log('----------------------------------------------------');
};

export default func;
func.tags = ['BuzzMintFactory', 'all'];
func.dependencies = []; // No dependencies on other contracts
