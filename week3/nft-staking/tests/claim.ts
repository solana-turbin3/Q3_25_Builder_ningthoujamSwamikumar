import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { createNfts, createValues, ITestValues, ReturnNfts, waitForFreezePeriod } from "./util";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe.only("claim rewards", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.nftStaking as Program<NftStaking>;
  const { connection, wallet } = program.provider;

  let values: ITestValues;
  let nftValues: ReturnNfts;

  beforeEach(async () => {
    nftValues = await createNfts(connection, wallet.payer);
    values = await createValues({}, wallet.publicKey, nftValues);

    //airdrop the admin
    const recentBlockhash = await connection.getLatestBlockhash("confirmed");
    const airdropTx = await connection.requestAirdrop(values.admin.publicKey, 100 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction({ blockhash: recentBlockhash.blockhash, lastValidBlockHeight: recentBlockhash.lastValidBlockHeight, signature: airdropTx }, "confirmed");

    await program.methods.initializeConfig(values.points_per_stake, values.max_unstake, values.freeze_period)
      .accounts({
        admin: values.admin.publicKey,
        tokenProgram: values.tokenProgram
      }).signers([values.admin]).rpc({ commitment: "confirmed" });
    console.log("initialized config ✔️");

    await program.methods.initializeUser()
      .accounts({
        user: wallet.publicKey
      }).rpc({ commitment: "confirmed" });
    console.log("initialized user ✔️");

    await program.methods.stakeNft()
      .accounts({
        mint: nftValues.nft1,
        tokenProgram: values.tokenProgram,
        user: wallet.publicKey,
      }).rpc({ commitment: "confirmed" });
    console.log("nft1 staked ✔️");

    await program.methods.stakeNft()
      .accounts({
        mint: nftValues.nft2,
        tokenProgram: values.tokenProgram,
        user: wallet.publicKey,
      }).rpc({ commitment: "confirmed" });
    console.log("nft2 staked ✔️");

    //wait freeze period
    await waitForFreezePeriod(program.provider, values.admin, values.freeze_period);

    const unstakedTx = await program.methods.unstakeNft()
      .accounts({
        tokenProgram: values.tokenProgram,
        user: wallet.publicKey,
        config: values.config,
        userAccount: values.userAccount,
        mint: nftValues.nft1,
        stakeAccount: values.stakeAccounts[0],
      }).rpc({ commitment: "confirmed" });
    console.log("nft unstaked ✔️");
  })

  it("claim", async () => {
    const rewardAtaInfo = await connection.getAccountInfo(values.reward_ata);
    let rewardAmount = 0;
    if (rewardAtaInfo) rewardAmount = parseInt((await connection.getTokenAccountBalance(values.reward_ata)).value.amount);
    const userAccountData = await program.account.userAccount.fetch(values.userAccount);
    expect(userAccountData.points).to.be.greaterThan(0);
    console.log("Expectation✅ - userAccount.points > 0");

    await program.methods.claimReward()
      .accounts({
        tokenProgram: values.tokenProgram,
        user: wallet.publicKey,
        userAccount: values.userAccount,
        config: values.config
      }).rpc();
    console.log("reward claimed ✔️");

    const newRewardAmount = parseInt((await connection.getTokenAccountBalance(values.reward_ata)).value.amount);
    expect(newRewardAmount).to.be.greaterThan(rewardAmount);
    console.log("Expectation✅ - newRewardAmount > rewardAmount");

    const newUserAccountData = await program.account.userAccount.fetch(values.userAccount);
    expect(newUserAccountData.points).to.be.equal(0);
    console.log("Expectation✅ - newUserAccountData.points is 0");
  });
});
