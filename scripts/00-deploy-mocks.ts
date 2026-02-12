import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { developmentChains } from "../utils.data";

const deployMocks: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    if (developmentChains.includes(network.name)) {
        log("----------------------------------------------------");
        log("检测到本地网络，正在部署 VRF v2.5 Mock...");
        
        // Deploy VRF Coordinator v2.5 Mock
        await deploy("VRFCoordinatorMock", {
            from: deployer,
            log: true,
            args: [],
        });
        
        log("VRF v2.5 Mock 部署完成!");
        log("----------------------------------------------------");
    }
};
export default deployMocks;
deployMocks.tags = ["all", "mocks"];