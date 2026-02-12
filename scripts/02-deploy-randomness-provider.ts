import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { networkConfig, developmentChains } from "../utils.data";
import { verify } from "../utils/verify";

const deployRandomnessProvider: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments, network, ethers } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId ?? 31337;
    let vrfCoordinatorV2Address;
    let subscriptionId;

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorMock");
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;

        // ✅ 本地固定 subId，保证 determinism
        const FIXED_SUB_ID = 1;
        subscriptionId = FIXED_SUB_ID;

        // VRF v2.5 mock 不需要创建订阅和充值，直接使用即可
        log("使用 VRF v2.5 Mock，订阅 ID: " + subscriptionId);
    } else {
        // Sepolia 或其他测试网
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }

    const cfg = networkConfig[chainId] ?? networkConfig[31337] ?? {
        gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        callbackGasLimit: "500000",
    };

    const args = [
        subscriptionId,
        vrfCoordinatorV2Address,
        cfg.gasLane,
        cfg.callbackGasLimit,
    ];

    log("正在部署 RandomnessProvider...");
    log(`  Subscription ID: ${subscriptionId}`);
    log(`  VRF Coordinator: ${vrfCoordinatorV2Address}`);
    log(`  Key Hash: ${cfg.gasLane}`);
    log(`  Callback Gas Limit: ${cfg.callbackGasLimit}`);
    
    const randomnessProvider = await deploy("RandomnessProvider", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: 1,
    });

    if (developmentChains.includes(network.name)) {
        // VRF v2.5 mock 不需要手动添加 consumer
        log("✅ VRF v2.5 Mock 部署完成！");
    }
    
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(randomnessProvider.address, args);
    }
};
export default deployRandomnessProvider;
deployRandomnessProvider.tags = ["all", "provider"];