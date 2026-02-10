import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

/**
 * DiceGame Deployment Script (hardhat-deploy standard)
 * 
 * Usage:
 * 1. Start local node: npx hardhat node --no-deploy
 * 2. Deploy DiceGame: npx hardhat deploy --tags DiceGame --network localhost
 * 
 * Features:
 * - Uses deployments.getOrNull() to get or deploy Treasury and RandomnessProvider
 * - Uses deployments.deploy() to deploy DiceGame contract
 * - Authorizes DiceGame to access Treasury (setGame)
 * - Funds Treasury in local environment
 */
const deployDiceGame: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network, ethers } = hre;
  const { deploy, getOrNull, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("\n----------------------------------------------------");
  log("🎲 Starting DiceGame Deployment");
  log("----------------------------------------------------");


  // ========================================
  // 1. Get or deploy dependencies (using getOrNull)
  // ========================================
  
  let treasuryAddress: string;
  let randomnessProviderAddress: string;

  // 1.1 Get or deploy Treasury
  const existingTreasury = await getOrNull("Treasury");
  
  if (existingTreasury) {
    treasuryAddress = existingTreasury.address;
    log(`✅ Found deployed Treasury: ${treasuryAddress}`);
  } else {
    log("⚠️  Treasury not deployed, deploying minimal version...");
    const maxPayoutPerTx = ethers.utils.parseEther("10"); // 10 ETH sufficient for max payout
    
    const treasuryDeployment = await deploy("Treasury", {
      from: deployer,
      args: [maxPayoutPerTx],
      log: true,
      waitConfirmations: 1,
    });
    
    treasuryAddress = treasuryDeployment.address;
    log(`✅ Treasury deployed: ${treasuryAddress}`);
  }

  // 1.2 Get or deploy RandomnessProvider
  const existingProvider = await getOrNull("RandomnessProvider");
  
  if (existingProvider) {
    randomnessProviderAddress = existingProvider.address;
    log(`✅ Found deployed RandomnessProvider: ${randomnessProviderAddress}`);
  } else {
    // Deploy minimal version of RandomnessProvider (requires VRF Mock)
    log("⚠️  RandomnessProvider not deployed, deploying minimal version...");
    
    // 1.2.1 Get or deploy VRF Mock
    let vrfCoordinatorAddress: string;
    let subscriptionId: any;
    
    const existingVRFMock = await getOrNull("VRFCoordinatorV2Mock");
    
    if (existingVRFMock) {
      vrfCoordinatorAddress = existingVRFMock.address;
      log(`✅ Found VRF Mock: ${vrfCoordinatorAddress}`);
    } else {
      // Deploy VRF Mock
      log("⚠️  VRF Mock not deployed, deploying...");
      const baseFee = ethers.utils.parseEther("0.1");
      const gasPriceLink = ethers.utils.parseEther("0.000000001");
      
      const vrfMockDeployment = await deploy("VRFCoordinatorV2Mock", {
        from: deployer,
        args: [baseFee, gasPriceLink],
        log: true,
        waitConfirmations: 1,
      });
      
      vrfCoordinatorAddress = vrfMockDeployment.address;
      log(`✅ VRF Mock deployed: ${vrfCoordinatorAddress}`);
    }

    // 1.2.2 Create VRF subscription
    const vrfCoordinatorV2Mock = await ethers.getContractAt(
      "VRFCoordinatorV2Mock",
      vrfCoordinatorAddress
    );
    
    const txResponse = await vrfCoordinatorV2Mock.createSubscription();
    const txReceipt = await txResponse.wait(1);
    subscriptionId = txReceipt.events[0].args.subId;
    
    // Fund subscription
    await vrfCoordinatorV2Mock.fundSubscription(
      subscriptionId,
      ethers.utils.parseEther("2")
    );
    log(`✅ VRF Subscription created and funded: ${subscriptionId.toString()}`);

    // 1.2.3 Deploy RandomnessProvider
    const gasLane = "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc"; // Local test value
    const callbackGasLimit = 500000;
    
    const providerDeployment = await deploy("RandomnessProvider", {
      from: deployer,
      args: [subscriptionId, vrfCoordinatorAddress, gasLane, callbackGasLimit],
      log: true,
      waitConfirmations: 1,
    });
    
    randomnessProviderAddress = providerDeployment.address;
    
    // Add consumer
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId, randomnessProviderAddress);
    log(`✅ RandomnessProvider deployed and added as consumer: ${randomnessProviderAddress}`);
  }

  // ========================================
  // 2. Deploy DiceGame (using deployments.deploy)
  // ========================================
  
  log("\n📦 Deploying DiceGame...");
  
  // DiceGame constructor parameters (strictly matches DiceGame.sol lines 74-78)
  // constructor(address randomnessProvider, address treasury, uint256 minBet, uint256 maxBet)
  const minBet = ethers.utils.parseEther("0.001"); // 0.001 ETH
  const maxBet = ethers.utils.parseEther("1");     // 1 ETH
  
  const diceGameArgs = [
    randomnessProviderAddress,
    treasuryAddress,
    minBet,
    maxBet,
  ];

  const diceGame = await deploy("DiceGame", {
    from: deployer,
    args: diceGameArgs,
    log: true,
    waitConfirmations: 1,
  });

  log(`✅ DiceGame deployed: ${diceGame.address}`);

  // ========================================
  // 3. Authorize DiceGame to access Treasury (setGame)
  // ========================================
  
  log("\n🔐 Authorizing DiceGame to access Treasury...");
  
  const treasury = await ethers.getContractAt("Treasury", treasuryAddress);
  
  // Check if already authorized
  try {
    const isAuthorized = await treasury.isGame(diceGame.address);
    
    if (!isAuthorized) {
      // Treasury.setGame(address game, bool allowed)
      const signer = await ethers.getSigner(deployer);
      const authTx = await treasury.connect(signer).setGame(diceGame.address, true);
      await authTx.wait(1);
      log(`✅ DiceGame authorized to access Treasury`);
    } else {
      log(`✅ DiceGame already authorized`);
    }
  } catch (error) {
    // If check fails, try to authorize directly
    log("⚠️  Cannot check authorization status, attempting direct authorization...");
    try {
      const signer = await ethers.getSigner(deployer);
      const authTx = await treasury.connect(signer).setGame(diceGame.address, true);
      await authTx.wait(1);
      log(`✅ DiceGame authorized to access Treasury`);
    } catch (authError: any) {
      log(`⚠️  Authorization failed: ${authError.message}`);
    }
  }

  // ========================================
  // 4. Local environment: Fund Treasury
  // ========================================
  
  if (network.name === "localhost" || network.name === "hardhat") {
    log("\n💰 Local environment: Funding Treasury...");
    
    try {
      const signer = await ethers.getSigner(deployer);
      const fundAmount = ethers.utils.parseEther("10"); // Fund 10 ETH
      
      const fundTx = await signer.sendTransaction({
        to: treasuryAddress,
        value: fundAmount,
      });
      await fundTx.wait(1);
      log(`✅ Treasury funded with ${ethers.utils.formatEther(fundAmount)} ETH`);
    } catch (fundError: any) {
      log(`⚠️  Funding failed: ${fundError.message}`);
    }
  }

  // ========================================
  // 5. Output deployment information using deployments.log()
  // ========================================
  
  log("\n----------------------------------------------------");
  log("📋 Deployment Summary");
  log("----------------------------------------------------");
  log(`DiceGame address:            ${diceGame.address}`);
  log(`Treasury address:            ${treasuryAddress}`);
  log(`RandomnessProvider address:  ${randomnessProviderAddress}`);
  log(`Minimum bet:                 ${ethers.utils.formatEther(minBet)} ETH`);
  log(`Maximum bet:                 ${ethers.utils.formatEther(maxBet)} ETH`);
  log(`Maximum payout:              ${ethers.utils.formatEther(maxBet.mul(6).mul(98).div(100))} ETH`);
  log(`Network:                     ${network.name}`);
  log("----------------------------------------------------\n");
};

export default deployDiceGame;

// Deployment tags
deployDiceGame.tags = ["DiceGame", "dicegame"];

