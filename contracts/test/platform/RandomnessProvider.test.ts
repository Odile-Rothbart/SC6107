import { assert } from "chai";
import { deployments, ethers } from "hardhat";

describe("RandomnessProvider Unit Tests", async function () {
    let randomnessProvider: any;

    beforeEach(async function () {
        await deployments.fixture(["all"]);
        randomnessProvider = await ethers.getContract("RandomnessProvider");
    });

    it("Should successfully request a random number and emit event", async function () {
        const txResponse = await randomnessProvider.requestRandomWords();
        const txReceipt = await txResponse.wait(1);
        const requestEvent = txReceipt.events.find((e: any) => e.event === "RequestSent");
        assert.isDefined(requestEvent);
        assert.isNotNull(requestEvent.args.requestId);
    });
});