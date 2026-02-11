import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { networkConfig, developmentChains } from "../utils.data";
import { verify } from "../utils/verify";

const deployRandomnessProvider: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments, network, ethers } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId ?? 31337;
    let vrfCoordinatorV2Address, subscriptionId;

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;

        // ✅ 本地固定 subId，保证 determinism
        const FIXED_SUB_ID = 1;
        subscriptionId = FIXED_SUB_ID;

        // 如果订阅还没创建/没法充值，就先创建一次再充值
        try {
            await vrfCoordinatorV2Mock.fundSubscription(
            subscriptionId,
            ethers.utils.parseEther("2")
            );
        } catch (e) {
            const tx = await vrfCoordinatorV2Mock.createSubscription();
            await tx.wait(1);
            await vrfCoordinatorV2Mock.fundSubscription(
            subscriptionId,
            ethers.utils.parseEther("2")
            );
        }
        } else {
        vrfCoordinatorV2Address = networkConfig[chainId!]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId!]["subscriptionId"];
        }


    const cfg =
    networkConfig[chainId] ??
    networkConfig[31337] ?? {
        gasLane:
        "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        callbackGasLimit: "500000",
    };

    const args = [
    subscriptionId,
    vrfCoordinatorV2Address,
    cfg.gasLane,
    cfg.callbackGasLimit,
    ];

    log("正在部署 RandomnessProvider...");
    const randomnessProvider = await deploy("RandomnessProvider", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: 1,
    });

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, randomnessProvider.address);
        log("✅ 已在本地 Mock 中添加 Consumer！");
    }
    
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(randomnessProvider.address, args);
    }
};
export default deployRandomnessProvider;
deployRandomnessProvider.tags = ["all", "provider"];