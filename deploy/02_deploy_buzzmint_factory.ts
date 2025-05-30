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

  // Verify the contract on Etherscan if we're not on a local network
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    log('Verifying contract on Etherscan...');
    try {
      await hre.run('verify:verify', {
        address: buzzMintFactory.address,
        constructorArguments: [],
        contract: 'contracts/BuzzMintCollectionFactory.sol:BuzzMintCollectionFactory',
      });
      log('Contract verified successfully');
    } catch (error) {
      log('Error verifying contract:', error);
    }
  }

  // Log deployment information for easy access
  log('----------------------------------------------------');
  log('BuzzMint Factory Deployment Summary:');
  log(`Network: ${network.name}`);
  log(`Deployer: ${deployer}`);
  log(`Factory Address: ${buzzMintFactory.address}`);
  log('----------------------------------------------------');
};

export default func;
func.tags = ['BuzzMintFactory', 'all'];
func.dependencies = []; // No dependencies on other contracts
