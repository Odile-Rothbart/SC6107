import { network } from "hardhat";

export const developmentChains = ["hardhat", "localhost"];

export const networkConfig: { [key: number]: any } = {
    11155111: {
        name: "sepolia",
        subscriptionId: "110321949091424563815134705693528832364149820012286083294824127195116609013964",
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
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