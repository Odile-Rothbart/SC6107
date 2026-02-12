import { network } from "hardhat";

export const developmentChains = ["hardhat", "localhost"];

export const networkConfig: { [key: number]: any } = {
    11155111: {
        name: "sepolia",
        subscriptionId: "3066552608327859797891664654094611013914157956849122446945087242953245848080",
        gasLane: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae", // 500 gwei (Sepolia 唯一选项)
        vrfCoordinatorV2: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B", // VRF V2.5 Coordinator
        callbackGasLimit: "500000",
        keepersUpdateInterval: "30",
    },
    31337: {
        name: "hardhat",
        subscriptionId: "588",
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        callbackGasLimit: "500000",
        keepersUpdateInterval: "30",
    },
};