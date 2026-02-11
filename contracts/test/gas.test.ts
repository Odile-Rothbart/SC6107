import { deployments, ethers, network } from "hardhat";
import { expect } from "chai";

async function increaseTime(seconds: number) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

async function gasOf(p: Promise<any>) {
  const tx = await p;
  const rc = await tx.wait();
  return rc.gasUsed.toString(); // ethers v5 BigNumber -> string
}

describe("Gas measurements (local, txReceipt.gasUsed)", function () {
  let vrf: any;
  let provider: any;
  let treasury: any;
  let dice: any;
  let raffle: any;
  let deployer: any;
  let user1: any;
  let user2: any;

  beforeEach(async () => {
    [deployer, user1, user2] = await ethers.getSigners();
    await deployments.fixture();

    vrf = await ethers.getContract("VRFCoordinatorV2Mock");
    provider = await ethers.getContract("RandomnessProvider");
    treasury = await ethers.getContract("Treasury");
    dice = await ethers.getContract("DiceGame");
    raffle = await ethers.getContract("Raffle");
  });

  it("records gas for hot paths: Dice / Raffle / Treasury", async () => {
    const rows: Array<{ op: string; gas: string }> = [];

    // ---- Dice: placeBet + VRF fulfill ----
    const betValue = ethers.utils.parseEther("0.05");
    const choice = 3;

    // placeBet
    const txBet = await dice.connect(user1).placeBet(choice, { value: betValue });
    const rcBet = await txBet.wait();
    rows.push({ op: "Dice.placeBet", gas: rcBet.gasUsed.toString() });

    // parse requestId from RandomnessRequested(betId, requestId)
    const evBet = (rcBet.events || []).find((e: any) => e.event === "RandomnessRequested");
    expect(evBet, "Missing RandomnessRequested in Dice.placeBet").to.not.eq(undefined);
    const requestIdDice = evBet.args.requestId;

    // fulfill (VRF -> Provider -> Dice.fulfillRandomness)
    const gasFulfillDice = await gasOf(vrf.fulfillRandomWords(requestIdDice, provider.address));
    rows.push({ op: "VRF.fulfillRandomWords (Dice path)", gas: gasFulfillDice });

    // ---- Raffle: enter + performUpkeep + VRF fulfill ----
    const fee = await raffle.getEntrancyFee();

    const gasEnter1 = await gasOf(raffle.connect(user1).enterRaffle({ value: fee }));
    rows.push({ op: "Raffle.enterRaffle (p1)", gas: gasEnter1 });

    const gasEnter2 = await gasOf(raffle.connect(user2).enterRaffle({ value: fee }));
    rows.push({ op: "Raffle.enterRaffle (p2)", gas: gasEnter2 });

    const interval = await raffle.getInterval();
    await increaseTime(interval.toNumber() + 1);

    const txUpkeep = await raffle.connect(deployer).performUpkeep("0x");
    const rcUpkeep = await txUpkeep.wait();
    rows.push({ op: "Raffle.performUpkeep", gas: rcUpkeep.gasUsed.toString() });

    const evUpkeep = (rcUpkeep.events || []).find((e: any) => e.event === "RandomnessRequested");
    expect(evUpkeep, "Missing RandomnessRequested in Raffle.performUpkeep").to.not.eq(undefined);
    const requestIdRaffle = evUpkeep.args.requestId;

    const gasFulfillRaffle = await gasOf(vrf.fulfillRandomWords(requestIdRaffle, provider.address));
    rows.push({ op: "VRF.fulfillRandomWords (Raffle path)", gas: gasFulfillRaffle });

    // ---- Treasury: adminWithdraw (if exists) ----
    // Many treasuries have owner-only adminWithdraw(address,uint256)
    if (treasury.adminWithdraw) {
      // withdraw a tiny amount if treasury has any balance; otherwise skip
      const bal = await ethers.provider.getBalance(treasury.address);
      if (bal.gt(0)) {
        const amt = bal.div(100); // 1% to avoid draining
        const gasAdminWd = await gasOf(treasury.connect(deployer).adminWithdraw(deployer.address, amt));
        rows.push({ op: "Treasury.adminWithdraw", gas: gasAdminWd });
      }
    }

    // Print a simple table (copy into report)
    console.log("\nGasUsed (local / Hardhat):");
    for (const r of rows) {
      console.log(`- ${r.op}: ${r.gas}`);
    }
  });
});
