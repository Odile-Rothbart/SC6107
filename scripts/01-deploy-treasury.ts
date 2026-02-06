import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;

  const { deployer } = await getNamedAccounts();

  // NOTE: your Treasury constructor expects uint256 maxPayoutPerTx
  const maxPayoutPerTx = ethers.utils.parseEther("1"); // adjust if needed

  const res = await deploy("Treasury", {
    from: deployer,
    args: [maxPayoutPerTx],
    log: true,
  });

  log(`Treasury deployed at: ${res.address} (network=${network.name})`);

  // Optional: fund treasury on localhost/hardhat for UI demo
  if (network.name === "localhost" || network.name === "hardhat") {
    const signer = await ethers.getSigner(deployer);
    const tx = await signer.sendTransaction({
      to: res.address,
      value: ethers.utils.parseEther("1"),
    });
    await tx.wait();
    log("Treasury funded with 1 ETH (local demo)");
  }
};

export default func;
func.tags = ["Treasury"];
