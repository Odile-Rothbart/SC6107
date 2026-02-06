import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { networkConfig, developmentChains } from "../utils.data";
import { verify } from "../utils/verify";

const deployRandomnessProvider: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments, network, ethers } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    let vrfCoordinatorV2Address, subscriptionId;

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
        const tx = await vrfCoordinatorV2Mock.createSubscription();
        const txReceipt = await tx.wait(1);
        subscriptionId = txReceipt.events[0].args.subId;
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, ethers.utils.parseEther("2")); 
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId!]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId!]["subscriptionId"];
    }

    const args = [subscriptionId, vrfCoordinatorV2Address, networkConfig[chainId!]["gasLane"], networkConfig[chainId!]["callbackGasLimit"]];

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