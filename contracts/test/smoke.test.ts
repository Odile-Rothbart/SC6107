import { expect } from "chai";
import { deployments, ethers, network } from "hardhat";
import type { Contract } from "ethers";

function getEventArg(receipt: any, contract: Contract, eventName: string, argName: string): any {
  for (const log of receipt.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === eventName) {
        return parsed.args[argName];
      }
    } catch {}
  }
  return null;
}

async function increaseTime(seconds: number) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

describe("Smoke (Hardhat-deploy) — Dice + Raffle + VRFCoordinatorMock", function () {
  let vrf: Contract;
  let randomnessProvider: Contract;
  let treasury: Contract;
  let dice: Contract;
  let raffle: Contract;

  beforeEach(async () => {
    // Deploy everything using hardhat-deploy
    // If you tagged deploy scripts, you can pass tags: fixture(["local"]) etc.
    await deployments.fixture();

    // These names must match your deploy script contract names.
    // Adjust here if your deployment names differ.
    vrf = await ethers.getContract("VRFCoordinatorV2Mock");
    randomnessProvider = await ethers.getContract("RandomnessProvider");
    treasury = await ethers.getContract("Treasury");
    dice = await ethers.getContract("DiceGame");
    raffle = await ethers.getContract("Raffle");
  });

  it("Dice E2E: placeBet -> request -> VRF fulfill -> settled", async () => {
    const [, player] = await ethers.getSigners();

    // pick a valid choice 1..6
    const choice = 3;

    // bet amount: if your minBet is higher than 0.01, increase it.
    // (DiceGame has no getter for minBet/maxBet)
    const betCandidates = [
      ethers.utils.parseEther("0.01"),
      ethers.utils.parseEther("0.05"),
      ethers.utils.parseEther("0.1"),
      ethers.utils.parseEther("0.2"),
      ethers.utils.parseEther("0.5"),
    ];

    let receipt: any = null;
    let lastErr: any = null;

    for (const v of betCandidates) {
      try {
        const tx = await dice.connect(player).placeBet(choice, { value: v });
        receipt = await tx.wait();
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
      }
    }

    expect(lastErr, `Dice placeBet failed; adjust betCandidates or check min/max bet`).to.eq(null);
    expect(receipt).to.not.eq(null);

    // Parse requestId from DiceGame event RandomnessRequested(betId, requestId)
    const requestId = getEventArg(receipt, dice, "RandomnessRequested", "requestId");
    expect(requestId, "Missing RandomnessRequested event / requestId").to.not.eq(null);

    // Fulfill on mock coordinator: fulfills RandomnessProvider, then RandomnessProvider calls DiceGame.fulfillRandomness
    const txFulfill = await vrf.fulfillRandomWords(requestId, await randomnessProvider.address);
    await txFulfill.wait();

    // Minimal assertion: Bet should be settled and diceResult should be 1..6
    // Dice stores bets in s_bets[betId], but betId also emitted in event.
    const betId = getEventArg(receipt, dice, "RandomnessRequested", "betId");
    expect(betId, "Missing betId in RandomnessRequested event").to.not.eq(null);

    const bet = await dice.getBet(betId);
    // BetStatus enum: OPEN=0, CALCULATING=1, SETTLED=2
    expect(bet.status).to.eq(2);
    expect(Number(bet.diceResult)).to.be.gte(1);
    expect(Number(bet.diceResult)).to.be.lte(6);
    expect(bet.player).to.eq(await player.address);
  });

  it("Raffle E2E: enter -> time passes -> performUpkeep -> VRF fulfill -> winner picked", async () => {
    const [deployer, p1, p2] = await ethers.getSigners();

    // entranceFee has a getter getEntrancyFee() (typo in contract)
    const fee = await raffle.getEntrancyFee();

    await (await raffle.connect(p1).enterRaffle({ value: fee })).wait();
    await (await raffle.connect(p2).enterRaffle({ value: fee })).wait();

    // Interval must pass before upkeep is needed
    const interval = await raffle.getInterval();
    await increaseTime(Number(interval) + 1);

    const txUpkeep = await raffle.connect(deployer).performUpkeep("0x");
    const rcUpkeep = await txUpkeep.wait();

    const requestId = getEventArg(rcUpkeep, raffle, "RandomnessRequested", "requestId");
    expect(requestId, "Missing RandomnessRequested event / requestId").to.not.eq(null);

    // Fulfill randomness via mock
    await (await vrf.fulfillRandomWords(requestId, await randomnessProvider.address)).wait();

    // Minimal assertion: previous round has winner (getRecentWinner)
    const winner = await raffle.getRecentWinner();
    expect(winner).to.not.eq(ethers.constants.AddressZero);

    // Optional: ensure new round started and is OPEN
    const state = await raffle.getRaffleState(); // current round state
    // OPEN = 0
    expect(state).to.eq(0);
  });
});
