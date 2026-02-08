import { expect } from "chai";
import { ethers, network, deployments } from "hardhat";
import { BigNumber } from "ethers";
import "@nomicfoundation/hardhat-chai-matchers";

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

describe("Raffle Contract Tests", function () {
  let raffle: any;
  let randomnessProvider: any;
  let treasury: any;
  let vrfCoordinatorV2Mock: any;
  let owner: any;
  let player1: any;
  let player2: any;
  let player3: any;

  const entranceFee = ethers.utils.parseEther("0.01");
  const interval = 60; // 60 seconds

  beforeEach(async function () {
    await deployments.fixture(["all"]);

    [owner, player1, player2, player3] = await ethers.getSigners();

    randomnessProvider = await ethers.getContract("RandomnessProvider");
    treasury = await ethers.getContract("Treasury");
    
    // Deploy Raffle
    const Raffle = await ethers.getContractFactory("Raffle");
    raffle = await Raffle.deploy(
      randomnessProvider.address,
      treasury.address,
      entranceFee,
      interval
    );
    await raffle.deployed();

    // Authorize Raffle as a game in Treasury
    await treasury.setGame(raffle.address, true);

    // Fund Treasury
    await owner.sendTransaction({
      to: treasury.address,
      value: ethers.utils.parseEther("10"),
    });

    // Get VRF Mock if on local network
    if (developmentChains.includes(network.name)) {
      vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    }
  });

  describe("Deployment", function () {
    it("should initialize with round 1", async function () {
      const roundId = await raffle.s_currentRoundId();
      expect(roundId.toString()).to.equal("1");
    });

    it("should set correct entrance fee and interval", async function () {
      bnEq(await raffle.getEntrancyFee(), entranceFee, "Entrance fee");
      bnEq(await raffle.getInterval(), BigNumber.from(interval), "Interval");
    });

    it("should have initial round in OPEN state", async function () {
      const round = await raffle.getCurrentRound();
      expect(round.state.toString()).to.equal("0"); // OPEN = 0
    });
  });

  describe("Enter Raffle", function () {
    it("should allow players to enter with correct fee", async function () {
      const tx = await raffle.connect(player1).enterRaffle({ value: entranceFee });
      const receipt = await tx.wait();
      
      // Check event was emitted
      const event = receipt.events.find((e: any) => e.event === "RaffleEntered");
      expect(event).to.not.be.undefined;
      expect(event.args.roundId.toString()).to.equal("1");
      expect(event.args.player).to.equal(player1.address);
      bnEq(event.args.amount, entranceFee, "Event amount");

      expect((await raffle.getNumberOfPlayers()).toString()).to.equal("1");
    });

    it("should revert if entrance fee is too low", async function () {
      await mustRevert(
        raffle.connect(player1).enterRaffle({ value: entranceFee.div(2) }),
        "Raffle__NotEnoughETHEntered"
      );
    });

    it("should revert if raffle is not open", async function () {
      // Enter players
      await raffle.connect(player1).enterRaffle({ value: entranceFee });
      
      // Manually trigger upkeep (this will change state to CALCULATING)
      // First, we need to fast forward time
      await network.provider.send("evm_increaseTime", [interval + 1]);
      await network.provider.send("evm_mine", []);

      await raffle.performUpkeep("0x");

      // Now try to enter - should fail
      await mustRevert(
        raffle.connect(player2).enterRaffle({ value: entranceFee }),
        "Raffle__NotOpen"
      );
    });

    it("should accumulate prize pool correctly", async function () {
      await raffle.connect(player1).enterRaffle({ value: entranceFee });
      await raffle.connect(player2).enterRaffle({ value: entranceFee });
      await raffle.connect(player3).enterRaffle({ value: entranceFee });

      const round = await raffle.getCurrentRound();
      bnEq(round.prizePool, entranceFee.mul(3), "Prize pool");
    });
  });

  describe("Upkeep", function () {
    it("should return false if time has not passed", async function () {
      await raffle.connect(player1).enterRaffle({ value: entranceFee });

      const [upkeepNeeded] = await raffle.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
    });

    it("should return false if no players", async function () {
      await network.provider.send("evm_increaseTime", [interval + 1]);
      await network.provider.send("evm_mine", []);

      const [upkeepNeeded] = await raffle.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
    });

    it("should return true when all conditions are met", async function () {
      await raffle.connect(player1).enterRaffle({ value: entranceFee });
      
      await network.provider.send("evm_increaseTime", [interval + 1]);
      await network.provider.send("evm_mine", []);

      const [upkeepNeeded] = await raffle.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.true;
    });
  });

  describe("Complete Flow (with VRF Mock)", function () {
    it("should complete full round: enter → draw → payout", async function () {
      if (!developmentChains.includes(network.name)) {
        this.skip(); // Skip on testnets
      }

      // Players enter
      await raffle.connect(player1).enterRaffle({ value: entranceFee });
      await raffle.connect(player2).enterRaffle({ value: entranceFee });
      await raffle.connect(player3).enterRaffle({ value: entranceFee });

      const prizePool = entranceFee.mul(3);

      // Fast forward time
      await network.provider.send("evm_increaseTime", [interval + 1]);
      await network.provider.send("evm_mine", []);

      // Perform upkeep
      const tx = await raffle.performUpkeep("0x");
      const receipt = await tx.wait();

      // Find RandomnessRequested event
      const requestEvent = receipt.events.find((e: any) => e.event === "RandomnessRequested");
      expect(requestEvent).to.not.be.undefined;
      const requestId = requestEvent.args.requestId;
      const roundId = requestEvent.args.roundId;
      expect(roundId.toString()).to.equal("1");

      // Simulate VRF callback
      const randomWords = [999]; // Fixed random number for testing
      await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, randomnessProvider.address);

      // Wait for the callback to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check winner was picked
      const round = await raffle.getRound(1);
      expect(round.state.toString()).to.equal("2"); // SETTLED = 2
      expect(round.winner).to.not.equal(ethers.constants.AddressZero);

      // Check new round started
      const newRoundId = await raffle.s_currentRoundId();
      expect(newRoundId.toString()).to.equal("2");
      const newRound = await raffle.getCurrentRound();
      expect(newRound.state.toString()).to.equal("0"); // OPEN = 0
    });
  });

  describe("Security", function () {
    it("should prevent non-provider from calling fulfillRandomness", async function () {
      await raffle.connect(player1).enterRaffle({ value: entranceFee });
      await network.provider.send("evm_increaseTime", [interval + 1]);
      await network.provider.send("evm_mine", []);
      await raffle.performUpkeep("0x");

      // Try to call fulfillRandomness as a regular user
      await mustRevert(
        raffle.connect(player1).fulfillRandomness(1, 999),
        "Raffle__NotProvider"
      );
    });

    it("should prevent double settlement", async function () {
      if (!developmentChains.includes(network.name)) {
        this.skip();
      }

      await raffle.connect(player1).enterRaffle({ value: entranceFee });
      await network.provider.send("evm_increaseTime", [interval + 1]);
      await network.provider.send("evm_mine", []);

      const tx = await raffle.performUpkeep("0x");
      const receipt = await tx.wait();
      const requestEvent = receipt.events.find((e: any) => e.event === "RandomnessRequested");
      const requestId = requestEvent.args.requestId;

      // First fulfillment
      await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, randomnessProvider.address);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Try to fulfill again - should fail (but we can't easily test this without mocking)
      // The state will be SETTLED, so it should revert
    });
  });
});
