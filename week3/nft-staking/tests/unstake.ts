import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { createNfts, createValues, ITestValues, ReturnNfts, waitForFreezePeriod } from "./util";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("unstake nft", () => {
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
  })

  it("unstake nft1", async () => {
    const walletBalance = await connection.getBalance(wallet.publicKey, "confirmed");
    const userAccountData = await program.account.userAccount.fetch(values.userAccount, "confirmed");
    console.log("userAccountData:", userAccountData);

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

    //checks if the accounts - stakeAccount and vault are closed and refunded
    const newWalletBalance = await connection.getBalance(wallet.publicKey, "confirmed");
    const unstakedTxDetails = await connection.getParsedTransaction(
      unstakedTx,
      { commitment: "confirmed", maxSupportedTransactionVersion: 0 }
    );
    expect(newWalletBalance).to.be.greaterThan(walletBalance - unstakedTxDetails.meta.fee);
    console.log("Expectation✅ - newWalletBalance is greater than walletBalance - tx.meta.fee");

    //check account closing
    const vaultInfo = await connection.getAccountInfo(values.vaults[0], "confirmed");
    expect(vaultInfo).to.be.null;
    const stakeAccountInfo = await connection.getAccountInfo(values.stakeAccounts[0], "confirmed");
    expect(stakeAccountInfo).to.be.null;
    console.log("Expectation✅ - stakeAccountInfo, and vaultInfo are null, meaning are closed.");

    const newUserAccountData = await program.account.userAccount.fetch(values.userAccount, "confirmed");
    console.log("newUserAccountData:", newUserAccountData);
    expect(newUserAccountData.amountStaked).to.be.greaterThan(0);
    expect(newUserAccountData.amountStaked).to.be.equal(userAccountData.amountStaked - 1);
    console.log("Expectation✅ - newUserAccountData.amountStaked is greater than 0, and equal to (userAccountData.amountStaked - 1)");

    expect(newUserAccountData.points).to.be.greaterThan(userAccountData.points);
    console.log("Expectation✅ - newUserAccountData.points is greater than userAccountData.points");
  });
});
