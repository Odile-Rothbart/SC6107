
export const developmentChains = ["hardhat", "localhost"];

export interface networkConfigItem {
  name?: string;
  subscriptionId?: string;
  gasLane?: string;
  callbackGasLimit?: string;
  vrfCoordinatorV2?: string;
  // 注意：entranceFee 和 interval 已经被移除
  // 因为它们现在属于具体的游戏合约参数，不属于网络配置
}

export interface networkConfigInfo {
  [key: number]: networkConfigItem;
}

export const networkConfig: networkConfigInfo = {
  // Hardhat 本地网络
  31337: {
    name: "localhost",
    gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 任意值，本地不验证
    callbackGasLimit: "500000",
  },
  // Sepolia 测试网 (替代了过时的 Goerli)
  11155111: {
    name: "sepolia",
    // Chainlink VRF Coordinator (Sepolia 官方地址)
    vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    // 30 gwei Key Hash
    gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
    subscriptionId: "0", // 之后申请了真实的再填
    callbackGasLimit: "500000",
  },
};