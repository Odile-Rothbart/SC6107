import { expect } from "chai";
import { deployments, ethers, network } from "hardhat";

/**
 * Minimal revert checker that does NOT depend on hardhat-chai-matchers.
 */
async function expectRevert(p: Promise<any>, reason?: string) {
  let reverted = false;
  try {
    await p;
  } catch (e) {
    reverted = true;
  }
  expect(reverted, reason ?? "Expected tx to revert").to.eq(true);
}

async function increaseTime(seconds: number) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

describe("Invariant-style checks (local, Hardhat + VRFCoordinatorV2Mock)", function () {
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

  it("INV-1: Treasury payout is permissioned (unauthorized caller cannot payout)", async () => {
    await expectRevert(
      treasury.connect(user1).payout(user1.address, 1),
      "Treasury.payout should revert for unauthorized caller"
    );
  });

  it("INV-2: Raffle state machine guard — performUpkeep reverts when upkeep is not needed", async () => {
    // No players, no funds => upkeep not needed => should revert
    await expectRevert(
      raffle.connect(deployer).performUpkeep("0x"),
      "performUpkeep should revert if upkeep conditions are not met"
    );
  });

  it("INV-3: Dice requestId can only be fulfilled once (no double settlement via repeated fulfill)", async () => {
    // Use a mid-range bet value. If your minBet is higher, adjust.
    const betValue = ethers.utils.parseEther("0.05");
    const choice = 3;

    const tx = await dice.connect(user1).placeBet(choice, { value: betValue });
    const rc = await tx.wait();

    // Dice emits RandomnessRequested(betId, requestId)
    const ev = (rc.events || []).find((e: any) => e.event === "RandomnessRequested");
    expect(ev, "Missing RandomnessRequested event").to.not.eq(undefined);

    const betId = ev.args.betId;
    const requestId = ev.args.requestId;

    // Fulfill once (drives: VRFMock -> RandomnessProvider -> DiceGame.fulfillRandomness)
    await (await vrf.fulfillRandomWords(requestId, provider.address)).wait();

    // After first fulfill, bet should be SETTLED
    const bet = await dice.getBet(betId);
    // BetStatus enum in DiceGame: OPEN=0, CALCULATING=1, SETTLED=2
    expect(bet.status.toString()).to.eq("2");

    // Fulfill again with same requestId should revert somewhere along the callback path
    await expectRevert(
      vrf.fulfillRandomWords(requestId, provider.address),
      "Re-fulfilling the same requestId should revert / be rejected"
    );
  });

  it("INV-4: Raffle E2E round completes with VRF mock and returns to OPEN", async () => {
    const fee = await raffle.getEntrancyFee();

    await (await raffle.connect(user1).enterRaffle({ value: fee })).wait();
    await (await raffle.connect(user2).enterRaffle({ value: fee })).wait();

    const interval = await raffle.getInterval();
    await increaseTime(interval.toNumber() + 1);

    // performUpkeep should succeed now
    const txUpkeep = await raffle.connect(deployer).performUpkeep("0x");
    const rcUpkeep = await txUpkeep.wait();

    const ev = (rcUpkeep.events || []).find((e: any) => e.event === "RandomnessRequested");
    expect(ev, "Missing RandomnessRequested event").to.not.eq(undefined);

    const requestId = ev.args.requestId;

    // fulfill randomness
    await (await vrf.fulfillRandomWords(requestId, provider.address)).wait();

    // winner must be non-zero; raffle returns to OPEN
    const winner = await raffle.getRecentWinner();
    expect(winner).to.not.eq(ethers.constants.AddressZero);

    const state = await raffle.getRaffleState(); // OPEN=0
    expect(state.toString()).to.eq("0");
  });

  it("INV-5 (light randomized repetition): multiple Dice bets settle without breaking state", async () => {
    const choices = [1, 2, 3, 4, 5, 6];
    const betValue = ethers.utils.parseEther("0.05");

    for (let i = 0; i < 5; i++) {
      const c = choices[Math.floor(Math.random() * choices.length)];
      const tx = await dice.connect(user1).placeBet(c, { value: betValue });
      const rc = await tx.wait();

      const ev = (rc.events || []).find((e: any) => e.event === "RandomnessRequested");
      expect(ev, "Missing RandomnessRequested event").to.not.eq(undefined);

      const betId = ev.args.betId;
      const requestId = ev.args.requestId;

      await (await vrf.fulfillRandomWords(requestId, provider.address)).wait();

      const bet = await dice.getBet(betId);
      expect(bet.status.toString()).to.eq("2"); // SETTLED
      expect(bet.player).to.eq(user1.address);
    }
  });
});
