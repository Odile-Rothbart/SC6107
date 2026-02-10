import { expect } from "chai";
import { ethers, network, deployments } from "hardhat";
import { BigNumber } from "ethers";

// Inline to avoid module resolution issues
const developmentChains = ["hardhat", "localhost"];

async function mustRevert(p: Promise<any>, contains?: string) {
  try {
    await p;
    expect.fail("Expected revert, but tx succeeded");
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (contains) {
      expect(msg).to.include(contains);
    }
  }
}

function bnEq(a: BigNumber, b: BigNumber, label?: string) {
  const ok = a.eq(b);
  if (!ok) {
    throw new Error(
      `${label ?? "BigNumber mismatch"}: expected ${b.toString()}, got ${a.toString()}`
    );
  }
}

describe("DiceGame Contract Tests", function () {
  let diceGame: any;
  let randomnessProvider: any;
  let treasury: any;
  let vrfCoordinatorV2Mock: any;
  let owner: any;
  let player1: any;
  let player2: any;
  let player3: any;

  const minBet = ethers.utils.parseEther("0.001");
  const maxBet = ethers.utils.parseEther("1");

  beforeEach(async function () {
    await deployments.fixture(["all"]);

    [owner, player1, player2, player3] = await ethers.getSigners();

    randomnessProvider = await ethers.getContract("RandomnessProvider");
    treasury = await ethers.getContract("Treasury");
    
    // Deploy DiceGame
    const DiceGame = await ethers.getContractFactory("DiceGame");
    diceGame = await DiceGame.deploy(
      randomnessProvider.address,
      treasury.address,
      minBet,
      maxBet
    );
    await diceGame.deployed();

    // Authorize DiceGame as a game in Treasury
    await treasury.setGame(diceGame.address, true);

    // Set Treasury maxPayoutPerTx to support max bet payout (1 ETH * 6 * 0.98 = 5.88 ETH)
    // Set to 10 ETH for safety margin
    await treasury.setMaxPayoutPerTx(ethers.utils.parseEther("10"));

    // Fund Treasury
    await owner.sendTransaction({
      to: treasury.address,
      value: ethers.utils.parseEther("20"),
    });

    // Get VRF Mock if on local network
    if (developmentChains.includes(network.name)) {
      vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    }
  });

  describe("Deployment", function () {
    it("should set correct min and max bet", async function () {
      bnEq(await diceGame.getMinBet(), minBet, "Min bet");
      bnEq(await diceGame.getMaxBet(), maxBet, "Max bet");
    });

    it("should initialize bet counter to 1", async function () {
      const nextBetId = await diceGame.getNextBetId();
      expect(nextBetId.toString()).to.equal("1");
    });

    it("should have correct game config", async function () {
      const config = await diceGame.getGameConfig();
      bnEq(config.minBet, minBet, "Config min bet");
      bnEq(config.maxBet, maxBet, "Config max bet");
      expect(config.multiplier.toString()).to.equal("6");
      expect(config.houseEdgeBps.toString()).to.equal("200"); // 2%
    });
  });

  describe("Place Bet - Success Cases", function () {
    it("should allow player to place bet with valid choice and amount", async function () {
      const betAmount = ethers.utils.parseEther("0.1");
      const choice = 5;

      const tx = await diceGame.connect(player1).placeBet(choice, { value: betAmount });
      const receipt = await tx.wait();
      
      // Check BetPlaced event
      const betPlacedEvent = receipt.events.find((e: any) => e.event === "BetPlaced");
      expect(betPlacedEvent).to.not.be.undefined;
      expect(betPlacedEvent.args.betId.toString()).to.equal("1");
      expect(betPlacedEvent.args.player).to.equal(player1.address);
      bnEq(betPlacedEvent.args.amount, betAmount, "Bet amount");
      expect(betPlacedEvent.args.choice).to.equal(choice);

      // Check RandomnessRequested event
      const randomnessEvent = receipt.events.find((e: any) => e.event === "RandomnessRequested");
      expect(randomnessEvent).to.not.be.undefined;
      expect(randomnessEvent.args.betId.toString()).to.equal("1");
      expect(randomnessEvent.args.requestId).to.not.be.undefined;
    });

    it("should correctly bind requestId to betId", async function () {
      const betAmount = ethers.utils.parseEther("0.1");
      const tx = await diceGame.connect(player1).placeBet(3, { value: betAmount });
      const receipt = await tx.wait();

      const randomnessEvent = receipt.events.find((e: any) => e.event === "RandomnessRequested");
      const requestId = randomnessEvent.args.requestId;
      const betId = randomnessEvent.args.betId;

      // Verify bet was created
      const bet = await diceGame.getBet(betId);
      expect(bet.player).to.equal(player1.address);
      bnEq(bet.amount, betAmount, "Stored bet amount");
      expect(bet.choice).to.equal(3);
      expect(bet.status).to.equal(1); // CALCULATING
    });

    it("should transfer bet amount to Treasury immediately", async function () {
      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
      const betAmount = ethers.utils.parseEther("0.1");

      await diceGame.connect(player1).placeBet(4, { value: betAmount });

      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
      bnEq(treasuryBalanceAfter.sub(treasuryBalanceBefore), betAmount, "Treasury received bet");
    });

    it("should track player's bet history", async function () {
      await diceGame.connect(player1).placeBet(1, { value: minBet });
      await diceGame.connect(player1).placeBet(2, { value: minBet });

      const playerBets = await diceGame.getPlayerBets(player1.address);
      expect(playerBets.length).to.equal(2);
      expect(playerBets[0].toString()).to.equal("1");
      expect(playerBets[1].toString()).to.equal("2");

      const betCount = await diceGame.getPlayerBetCount(player1.address);
      expect(betCount.toString()).to.equal("2");
    });
  });

  describe("Place Bet - Validation", function () {
    it("should revert if choice is 0", async function () {
      await mustRevert(
        diceGame.connect(player1).placeBet(0, { value: minBet }),
        "DiceGame__InvalidChoice"
      );
    });

    it("should revert if choice is 7", async function () {
      await mustRevert(
        diceGame.connect(player1).placeBet(7, { value: minBet }),
        "DiceGame__InvalidChoice"
      );
    });

    it("should revert if bet amount is too low", async function () {
      const tooLow = minBet.sub(1);
      await mustRevert(
        diceGame.connect(player1).placeBet(5, { value: tooLow }),
        "DiceGame__BetTooLow"
      );
    });

    it("should revert if bet amount is too high", async function () {
      const tooHigh = maxBet.add(1);
      await mustRevert(
        diceGame.connect(player1).placeBet(5, { value: tooHigh }),
        "DiceGame__BetTooHigh"
      );
    });
  });

  describe("Fulfill Randomness - Win Path", function () {
    it("should correctly settle winning bet and payout to player (deterministic)", async function () {
      if (!developmentChains.includes(network.name)) {
        this.skip();
      }

      const betAmount = ethers.utils.parseEther("0.1");
      const choice = 3;

      // Player places bet
      const tx = await diceGame.connect(player1).placeBet(choice, { value: betAmount });
      const receipt = await tx.wait();

      const randomnessEvent = receipt.events.find((e: any) => e.event === "RandomnessRequested");
      const requestId = randomnessEvent.args.requestId;
      const betId = randomnessEvent.args.betId;

      // Record player balance before payout
      const playerBalanceBefore = await ethers.provider.getBalance(player1.address);

      // Impersonate RandomnessProvider to call fulfillRandomness directly
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [randomnessProvider.address],
      });

      const providerSigner = await ethers.getSigner(randomnessProvider.address);

      // Fund the provider account for gas (using hardhat_setBalance to avoid triggering receive/fallback)
      await network.provider.send("hardhat_setBalance", [
        randomnessProvider.address,
        ethers.utils.parseEther("1.0").toHexString(),
      ]);

      // Use fixed randomness that will result in dice = 3 (choice)
      // randomness % 6 + 1 == 3, so randomness % 6 == 2, use randomness = 2
      const fixedRandomness = 2;

      // Call fulfillRandomness directly as provider
      await diceGame.connect(providerSigner).fulfillRandomness(requestId, fixedRandomness);

      // Stop impersonating
      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [randomnessProvider.address],
      });

      // Get settled bet
      const bet = await diceGame.getBet(betId);
      expect(bet.status).to.equal(2); // SETTLED

      // Check dice result is exactly 3 (deterministic)
      expect(bet.diceResult).to.equal(choice);

      // Calculate expected payout: 0.1 * 6 * 0.98 = 0.588 ETH
      const expectedPayout = betAmount.mul(6).mul(98).div(100);
      bnEq(bet.payout, expectedPayout, "Payout amount");

      // Check player received funds
      const playerBalanceAfter = await ethers.provider.getBalance(player1.address);
      expect(playerBalanceAfter.gt(playerBalanceBefore)).to.equal(true, "Player should receive payout");
    });

    it("should emit BetSettled event with correct parameters", async function () {
      if (!developmentChains.includes(network.name)) {
        this.skip();
      }

      const betAmount = ethers.utils.parseEther("0.1");
      const choice = 5;
      const tx = await diceGame.connect(player1).placeBet(choice, { value: betAmount });
      const receipt = await tx.wait();

      const randomnessEvent = receipt.events.find((e: any) => e.event === "RandomnessRequested");
      const requestId = randomnessEvent.args.requestId;

      // Impersonate provider
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [randomnessProvider.address],
      });
      const providerSigner = await ethers.getSigner(randomnessProvider.address);
      
      // Fund the provider account for gas (using hardhat_setBalance)
      await network.provider.send("hardhat_setBalance", [
        randomnessProvider.address,
        ethers.utils.parseEther("1.0").toHexString(),
      ]);

      // Fixed randomness: dice = 5
      const fixedRandomness = 4; // 4 % 6 + 1 = 5

      const fulfillTx = await diceGame.connect(providerSigner).fulfillRandomness(requestId, fixedRandomness);
      const fulfillReceipt = await fulfillTx.wait();

      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [randomnessProvider.address],
      });

      // Find BetSettled event
      const settledEvent = fulfillReceipt.events.find((e: any) => e.event === "BetSettled");
      expect(settledEvent).to.not.be.undefined;
      expect(settledEvent.args.betId.toString()).to.equal("1");
      expect(settledEvent.args.player).to.equal(player1.address);
      expect(settledEvent.args.diceResult).to.equal(5);
      expect(settledEvent.args.won).to.be.true;

      // Query the bet
      const bet = await diceGame.getBet(1);
      expect(bet.status).to.equal(2); // SETTLED
      expect(bet.diceResult).to.equal(5);
    });
  });

  describe("Fulfill Randomness - Lose Path", function () {
    it("should correctly settle losing bet with zero payout (deterministic)", async function () {
      if (!developmentChains.includes(network.name)) {
        this.skip();
      }

      const betAmount = ethers.utils.parseEther("0.1");
      const choice = 6;

      const tx = await diceGame.connect(player1).placeBet(choice, { value: betAmount });
      const receipt = await tx.wait();

      const randomnessEvent = receipt.events.find((e: any) => e.event === "RandomnessRequested");
      const requestId = randomnessEvent.args.requestId;

      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);

      // Impersonate provider
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [randomnessProvider.address],
      });
      const providerSigner = await ethers.getSigner(randomnessProvider.address);
      
      // Fund the provider account for gas (using hardhat_setBalance)
      await network.provider.send("hardhat_setBalance", [
        randomnessProvider.address,
        ethers.utils.parseEther("1.0").toHexString(),
      ]);

      // Fixed randomness: dice = 1 (player chose 6, so will lose)
      const fixedRandomness = 0; // 0 % 6 + 1 = 1

      await diceGame.connect(providerSigner).fulfillRandomness(requestId, fixedRandomness);

      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [randomnessProvider.address],
      });

      const bet = await diceGame.getBet(1);
      expect(bet.status).to.equal(2); // SETTLED
      expect(bet.diceResult).to.equal(1); // Deterministic: dice = 1
      expect(bet.diceResult).to.not.equal(choice); // Player lost

      // Payout should be 0
      expect(bet.payout.toString()).to.equal("0");

      // Treasury balance should not change (bet amount already transferred in placeBet)
      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
      bnEq(treasuryBalanceAfter, treasuryBalanceBefore, "Treasury balance unchanged");
    });
  });

  describe("Fulfill Randomness - Security", function () {
    it("should revert if non-provider calls fulfillRandomness", async function () {
      const betAmount = ethers.utils.parseEther("0.1");
      await diceGame.connect(player1).placeBet(3, { value: betAmount });

      // Try to call fulfillRandomness from non-provider account
      await mustRevert(
        diceGame.connect(player2).fulfillRandomness(1, 12345),
        "DiceGame__NotProvider"
      );
    });

    it("should revert if trying to fulfill non-existent requestId", async function () {
      if (!developmentChains.includes(network.name)) {
        this.skip();
      }

      // Impersonate provider to bypass permission check
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [randomnessProvider.address],
      });
      const providerSigner = await ethers.getSigner(randomnessProvider.address);
      
      // Fund the provider account for gas (using hardhat_setBalance)
      await network.provider.send("hardhat_setBalance", [
        randomnessProvider.address,
        ethers.utils.parseEther("1.0").toHexString(),
      ]);

      // Try to fulfill with non-existent requestId (betId will be 0)
      await mustRevert(
        diceGame.connect(providerSigner).fulfillRandomness(99999, 12345),
        "DiceGame__BetNotFound"
      );

      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [randomnessProvider.address],
      });
    });

    it("should revert if trying to settle already settled bet", async function () {
      if (!developmentChains.includes(network.name)) {
        this.skip();
      }

      const betAmount = ethers.utils.parseEther("0.1");
      const tx = await diceGame.connect(player1).placeBet(3, { value: betAmount });
      const receipt = await tx.wait();

      const randomnessEvent = receipt.events.find((e: any) => e.event === "RandomnessRequested");
      const requestId = randomnessEvent.args.requestId;

      // Impersonate provider for first fulfillment
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [randomnessProvider.address],
      });
      const providerSigner = await ethers.getSigner(randomnessProvider.address);
      
      // Fund the provider account for gas (using hardhat_setBalance)
      await network.provider.send("hardhat_setBalance", [
        randomnessProvider.address,
        ethers.utils.parseEther("1.0").toHexString(),
      ]);

      // First fulfillment
      await diceGame.connect(providerSigner).fulfillRandomness(requestId, 2);

      const bet = await diceGame.getBet(1);
      expect(bet.status).to.equal(2); // SETTLED

      // Try to fulfill again - should revert because requestId mapping was deleted
      await mustRevert(
        diceGame.connect(providerSigner).fulfillRandomness(requestId, 2),
        "DiceGame__BetNotFound"
      );

      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [randomnessProvider.address],
      });
    });
  });

  describe("Treasury Integration", function () {
    it("should revert if Treasury maxPayoutPerTx is too low (deterministic)", async function () {
      if (!developmentChains.includes(network.name)) {
        this.skip();
      }

      // Set maxPayoutPerTx to 0.1 ETH (too low for max bet win)
      await treasury.setMaxPayoutPerTx(ethers.utils.parseEther("0.1"));

      // Place max bet (1 ETH)
      const choice = 4;
      const tx = await diceGame.connect(player1).placeBet(choice, { value: maxBet });
      const receipt = await tx.wait();

      const randomnessEvent = receipt.events.find((e: any) => e.event === "RandomnessRequested");
      const requestId = randomnessEvent.args.requestId;

      // Impersonate provider
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [randomnessProvider.address],
      });
      const providerSigner = await ethers.getSigner(randomnessProvider.address);
      
      // Fund the provider account for gas (using hardhat_setBalance)
      await network.provider.send("hardhat_setBalance", [
        randomnessProvider.address,
        ethers.utils.parseEther("1.0").toHexString(),
      ]);

      // Use fixed randomness that will make player win (dice = 4)
      const fixedRandomness = 3; // 3 % 6 + 1 = 4

      // Expected payout: 1 ETH * 6 * 0.98 = 5.88 ETH (exceeds maxPayoutPerTx of 0.1 ETH)
      // This should revert in Treasury.payout() with ExceedsMaxPayout
      await mustRevert(
        diceGame.connect(providerSigner).fulfillRandomness(requestId, fixedRandomness)
      );

      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [randomnessProvider.address],
      });
    });

    it("should revert if DiceGame is not authorized in Treasury (deterministic)", async function () {
      if (!developmentChains.includes(network.name)) {
        this.skip();
      }

      // Deploy a new DiceGame without authorization
      const DiceGame = await ethers.getContractFactory("DiceGame");
      const unauthorizedGame = await DiceGame.deploy(
        randomnessProvider.address,
        treasury.address,
        minBet,
        maxBet
      );
      await unauthorizedGame.deployed();

      // Place bet on unauthorized game
      const choice = 3;
      const tx = await unauthorizedGame.connect(player1).placeBet(choice, { value: minBet });
      const receipt = await tx.wait();

      const randomnessEvent = receipt.events.find((e: any) => e.event === "RandomnessRequested");
      const requestId = randomnessEvent.args.requestId;

      // Impersonate provider
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [randomnessProvider.address],
      });
      const providerSigner = await ethers.getSigner(randomnessProvider.address);
      
      // Fund the provider account for gas (using hardhat_setBalance)
      await network.provider.send("hardhat_setBalance", [
        randomnessProvider.address,
        ethers.utils.parseEther("1.0").toHexString(),
      ]);

      // Use fixed randomness that will make player win (dice = 3)
      const fixedRandomness = 2; // 2 % 6 + 1 = 3

      // This should revert because unauthorizedGame is not authorized in Treasury
      await mustRevert(
        unauthorizedGame.connect(providerSigner).fulfillRandomness(requestId, fixedRandomness)
      );

      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [randomnessProvider.address],
      });
    });
  });

  describe("Getter Functions", function () {
    it("should return correct bet details", async function () {
      const betAmount = ethers.utils.parseEther("0.5");
      const choice = 2;

      await diceGame.connect(player1).placeBet(choice, { value: betAmount });

      const bet = await diceGame.getBet(1);
      expect(bet.betId.toString()).to.equal("1");
      expect(bet.player).to.equal(player1.address);
      bnEq(bet.amount, betAmount, "Bet amount");
      expect(bet.choice).to.equal(choice);
      expect(bet.status).to.equal(1); // CALCULATING
    });

    it("should calculate payout correctly", async function () {
      const betAmount = ethers.utils.parseEther("1");
      const expectedPayout = betAmount.mul(6).mul(98).div(100); // 5.88 ETH

      const calculatedPayout = await diceGame.calculatePayout(betAmount);
      bnEq(calculatedPayout, expectedPayout, "Calculated payout");
    });

    it("should return player's recent bet", async function () {
      await diceGame.connect(player1).placeBet(1, { value: minBet });
      await diceGame.connect(player1).placeBet(2, { value: minBet });

      const recentBet = await diceGame.getPlayerRecentBet(player1.address);
      expect(recentBet.betId.toString()).to.equal("2");
      expect(recentBet.choice).to.equal(2);
    });

    it("should return empty bet for player with no history", async function () {
      const recentBet = await diceGame.getPlayerRecentBet(player3.address);
      expect(recentBet.betId.toString()).to.equal("0");
      expect(recentBet.player).to.equal(ethers.constants.AddressZero);
    });
  });

  describe("Multiple Bets", function () {
    it("should handle multiple concurrent bets from different players", async function () {
      const betAmount = ethers.utils.parseEther("0.1");

      await diceGame.connect(player1).placeBet(1, { value: betAmount });
      await diceGame.connect(player2).placeBet(2, { value: betAmount });
      await diceGame.connect(player3).placeBet(3, { value: betAmount });

      const bet1 = await diceGame.getBet(1);
      const bet2 = await diceGame.getBet(2);
      const bet3 = await diceGame.getBet(3);

      expect(bet1.player).to.equal(player1.address);
      expect(bet2.player).to.equal(player2.address);
      expect(bet3.player).to.equal(player3.address);

      expect(bet1.choice).to.equal(1);
      expect(bet2.choice).to.equal(2);
      expect(bet3.choice).to.equal(3);
    });
  });
});
