import "dotenv/config";
import "hardhat-gas-reporter";
import "hardhat-deploy";
// import "hardhat-deploy-ethers";
import "@nomiclabs/hardhat-ethers";
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    deterministicDeployment: true,
    solidity: {
        version: "0.8.16",
        settings: {
            viaIR: true,
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },

    networks: {
        matic: {
            url: process.env.MATIC_RPC_URL || "",
            accounts,
        },

        goerli: {
            url: process.env.GOERLI_RPC_URL || "",
            accounts,
            chainId: 5,
            timeout: 100000,
        },
    },

    // etherscan: {
    //  apiKey: {
    //      goerli: process.env.ETHERSCAN_API_KEY ?? "",
    //  },
    // },

    gasReporter: {
        enabled: false,
        currency: "USD",
        outputFile: "gasReport.txt",
        noColors: true,
    },

    namedAccounts: {
        deployer: { default: 0 },
        player: { default: 1 },
    },

    // 【关键修改点】告诉 hardhat-deploy 去 scripts 文件夹找部署脚本
    paths: {
        sources: "./contracts/src",
        tests: "./contracts/test",
        cache: "./cache",
        artifacts: "./artifacts",
        deploy: "./scripts",
        deployments: "./deployments",
    },

    mocha: {
        timeout: 10000000,
    },
};

export default config;