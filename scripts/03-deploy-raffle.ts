import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// Verify function (inline to avoid import issues)
const verify = async (contractAddress: string, args: any[]) => {
    try {
        const { run } = require("hardhat");
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        });
    } catch (error: any) {
        if (error.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!");
        } else {
            console.log(error);
        }
    }
};

// Network configuration (inline to avoid import issues)
const developmentChains = ["hardhat", "localhost"];

const networkConfig: { [key: number]: any } = {
  // Hardhat 本地网络
  31337: {
    name: "localhost",
    gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
    callbackGasLimit: "500000",
  },
  // Sepolia 测试网
  11155111: {
    name: "sepolia",
    vrfCoordinatorV2: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B", // VRF V2.5 Coordinator
    gasLane: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae", // 500 gwei (Sepolia 唯一选项)
    subscriptionId: "3066552608327859797891664654094611013914157956849122446945087242953245848080",
    callbackGasLimit: "500000",
  },
};

/**
 * @title Deploy Raffle Platform
 * @notice Deploys Treasury, RandomnessProvider, and Raffle contracts in sequence
 * @dev This script ensures proper deployment order and configuration
 */
const deployRafflePlatform: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments, network, ethers } = hre;
    const { deploy, log, get } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    log("====================================================");
    log("🚀 Starting Raffle Platform Deployment");
    log("====================================================");

    // ============================================================
    // Step 1: Deploy Treasury
    // ============================================================
    log("\n----------------------------------------------------");
    log("📦 Step 1: Deploying Treasury...");
    log("----------------------------------------------------");

    const maxPayoutPerTx = "1000000000000000000000"; // 1000 ETH

    const treasury = await deploy("Treasury", {
        from: deployer,
        args: [maxPayoutPerTx],
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    // Verify on testnets
    if (!network.name.includes("hardhat") && !network.name.includes("localhost") && process.env.ETHERSCAN_API_KEY) {
        log("Verifying Treasury...");
        await verify(treasury.address, [maxPayoutPerTx]);
    }

    log(`✅ Treasury deployed at: ${treasury.address}`);

    // Fund Treasury (for testing)
    if (developmentChains.includes(network.name)) {
        const deployerSigner = await ethers.getSigner(deployer);
        const fundAmount = ethers.utils.parseEther("10");
        const fundTx = await deployerSigner.sendTransaction({
            to: treasury.address,
            value: fundAmount,
        });
        await fundTx.wait(1);
        log(`✅ Funded Treasury with ${ethers.utils.formatEther(fundAmount)} ETH`);
    }

    // ============================================================
    // Step 2: Deploy RandomnessProvider
    // ============================================================
    log("\n----------------------------------------------------");
    log("🎲 Step 2: Deploying RandomnessProvider...");
    log("----------------------------------------------------");

    let vrfCoordinatorV2Address, subscriptionId, keyHash, callbackGasLimit;

    // Configure for local or testnet
    if (developmentChains.includes(network.name)) {
        // Local network: use VRF v2.5 mock
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorMock");
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
        
        // VRF v2.5 mock doesn't need subscription creation, use fixed ID
        subscriptionId = "1";
        
        // Use config values or defaults
        keyHash = networkConfig[chainId!]?.gasLane || "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";
        callbackGasLimit = networkConfig[chainId!]?.callbackGasLimit || "500000";
        
        log(`✅ Using VRF v2.5 Mock with subscription ID: ${subscriptionId}`);
    } else {
        // Testnet: use real Chainlink VRF
        if (!networkConfig[chainId!]) {
            throw new Error(`Network config not found for chainId: ${chainId}`);
        }
        vrfCoordinatorV2Address = networkConfig[chainId!]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId!]["subscriptionId"];
        keyHash = networkConfig[chainId!]["gasLane"];
        callbackGasLimit = networkConfig[chainId!]["callbackGasLimit"];
    }

    const providerArgs = [
        subscriptionId,
        vrfCoordinatorV2Address,
        keyHash,
        callbackGasLimit,
    ];

    const randomnessProvider = await deploy("RandomnessProvider", {
        from: deployer,
        args: providerArgs,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    // Add consumer to subscription (local only)
    if (developmentChains.includes(network.name)) {
        // VRF v2.5 mock doesn't require manual consumer addition
        log("✅ VRF v2.5 Mock ready (no consumer registration needed)");
    }

    // Verify on testnets
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying RandomnessProvider...");
        await verify(randomnessProvider.address, providerArgs);
    }

    log(`✅ RandomnessProvider deployed at: ${randomnessProvider.address}`);

    // ============================================================
    // Step 3: Deploy Raffle
    // ============================================================
    log("\n----------------------------------------------------");
    log("🎟️ Step 3: Deploying Raffle Game...");
    log("----------------------------------------------------");

    const entranceFee = "10000000000000000"; // 0.01 ETH
    const interval = 300; // 300 seconds (5 minutes) - 可以根据需要修改

    const raffleArgs = [
        randomnessProvider.address,
        treasury.address,
        entranceFee,
        interval,
    ];

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: raffleArgs,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    // Authorize Raffle as a game in Treasury
    const treasuryContract = await ethers.getContractAt("Treasury", treasury.address);
    const authTx = await treasuryContract.setGame(raffle.address, true);
    await authTx.wait(1);
    log(`✅ Authorized Raffle (${raffle.address}) as a game in Treasury`);

    // Verify on testnets
    if (!network.name.includes("hardhat") && !network.name.includes("localhost") && process.env.ETHERSCAN_API_KEY) {
        log("Verifying Raffle...");
        await verify(raffle.address, raffleArgs);
    }

    log("\n====================================================");
    log("✅ Raffle Platform Deployment Complete!");
    log("====================================================");
    log("\n📋 Deployment Summary:");
    log(`   Treasury:            ${treasury.address}`);
    log(`   RandomnessProvider:  ${randomnessProvider.address}`);
    log(`   Raffle:              ${raffle.address}`);
    log(`\n🎮 Raffle Configuration:`);
    log(`   Entrance Fee:        ${entranceFee} wei (0.01 ETH)`);
    log(`   Draw Interval:       ${interval} seconds`);
    log("====================================================\n");
};

export default deployRafflePlatform;
deployRafflePlatform.tags = ["all", "raffle-platform"];
deployRafflePlatform.dependencies = ["mocks"]; // Ensure mocks are deployed first
