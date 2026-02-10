import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";

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

describe("Treasury (strict, no chai-matchers)", function () {
  async function deployFixture() {
    const [owner, game, attacker, user] = await ethers.getSigners();

    const maxPayoutPerTx = ethers.utils.parseEther("1"); // 1 ETH limit per tx
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.connect(owner).deploy(maxPayoutPerTx);
    await treasury.deployed();

    return { treasury, owner, game, attacker, user, maxPayoutPerTx };
  }

  it("only authorized game can payout (and payout transfers exact amount)", async function () {
    const { treasury, owner, game, attacker, user } = await deployFixture();

    const fund = ethers.utils.parseEther("2");
    await owner.sendTransaction({ to: treasury.address, value: fund });

    const amount = ethers.utils.parseEther("0.1");

    // not authorized -> must revert (do not assert custom error text; IR may hide it)
    await mustRevert(
      treasury.connect(attacker).payout(user.address, amount)
    );

    // authorize game
    await treasury.connect(owner).setGame(game.address, true);

    // measure balances before
    const tBefore = await ethers.provider.getBalance(treasury.address);
    const uBefore = await ethers.provider.getBalance(user.address);

    // payout
    const tx = await treasury.connect(game).payout(user.address, amount);
    await tx.wait();

    // measure balances after
    const tAfter = await ethers.provider.getBalance(treasury.address);
    const uAfter = await ethers.provider.getBalance(user.address);

    // Treasury must decrease by exactly amount (Treasury itself pays no gas)
    bnEq(tBefore.sub(tAfter), amount, "Treasury diff");

    // User must increase by exactly amount (user did not send a tx here)
    bnEq(uAfter.sub(uBefore), amount, "User diff");
  });

  it("rejects payout when treasury balance is insufficient", async function () {
    const { treasury, owner, game, user } = await deployFixture();

    await treasury.connect(owner).setGame(game.address, true);

    const amount = ethers.utils.parseEther("0.1");
    // treasury has 0 -> revert (custom error string may be hidden; check only revert)
    await mustRevert(
      treasury.connect(game).payout(user.address, amount)
    );
  });

  it("pause works and admin permissions work", async function () {
    const { treasury, owner, game, attacker, user } = await deployFixture();

    // fund treasury
    await owner.sendTransaction({
      to: treasury.address,
      value: ethers.utils.parseEther("2"),
    });

    // non-owner admin operations must revert with Ownable message (OZ v4)
    await mustRevert(
      treasury.connect(attacker).setGame(game.address, true),
      "Ownable: caller is not the owner"
    );
    await mustRevert(
      treasury.connect(attacker).pause(),
      "Ownable: caller is not the owner"
    );
    await mustRevert(
      treasury.connect(attacker).adminWithdraw(attacker.address, ethers.utils.parseEther("0.1")),
      "Ownable: caller is not the owner"
    );

    // owner authorizes game and pauses
    await treasury.connect(owner).setGame(game.address, true);
    await treasury.connect(owner).pause();

    // payout must revert while paused (OZ v4 string)
    await mustRevert(
      treasury.connect(game).payout(user.address, ethers.utils.parseEther("0.1")),
      "Pausable: paused"
    );

    // unpause then payout succeeds and transfers exact amount
    await treasury.connect(owner).unpause();

    const amount = ethers.utils.parseEther("0.1");
    const tBefore = await ethers.provider.getBalance(treasury.address);
    const uBefore = await ethers.provider.getBalance(user.address);

    const tx = await treasury.connect(game).payout(user.address, amount);
    await tx.wait();

    const tAfter = await ethers.provider.getBalance(treasury.address);
    const uAfter = await ethers.provider.getBalance(user.address);

    bnEq(tBefore.sub(tAfter), amount, "Treasury diff after unpause payout");
    bnEq(uAfter.sub(uBefore), amount, "User diff after unpause payout");

    // adminWithdraw should reduce treasury by exact amount
    const w = ethers.utils.parseEther("0.1");
    const t2Before = await ethers.provider.getBalance(treasury.address);

    const tx2 = await treasury.connect(owner).adminWithdraw(owner.address, w);
    await tx2.wait();

    const t2After = await ethers.provider.getBalance(treasury.address);
    bnEq(t2Before.sub(t2After), w, "Treasury diff after adminWithdraw");
  });
});
