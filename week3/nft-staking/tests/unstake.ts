import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { createNfts, createValues, ITestValues, ReturnNfts } from "./util";
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

    await program.methods.initializeConfig(120, 3, 60 * 60 * 24 * 30 * 6)
      .accounts({
        admin: values.admin.publicKey,
        tokenProgram: values.tokenProgram
      }).signers([values.admin]).rpc();
    console.log("✅ initialized config");

    await program.methods.initializeUser()
      .accounts({
        user: wallet.publicKey
      }).rpc();
    console.log("✅ initialized user");

    await program.methods.stakeNft()
      .accounts({
        mint: nftValues.nft1,
        tokenProgram: values.tokenProgram,
        user: wallet.publicKey,
      }).rpc({ commitment: "confirmed" });
    console.log("✅ nft1 staked");

    await program.methods.stakeNft()
      .accounts({
        mint: nftValues.nft2,
        tokenProgram: values.tokenProgram,
        user: wallet.publicKey,
      }).rpc({ commitment: "confirmed" });
    console.log("✅ nft2 staked");
  })

  it("unstake nft1", async () => {
    //const walletBalance = await connection.getBalance(wallet.publicKey, "confirmed");
    const userAccountData = await program.account.userAccount.fetch(values.userAccount, "confirmed");
    console.log("userAccountData:", userAccountData);
    await program.methods.unstakeNft()
      .accounts({
        tokenProgram: values.tokenProgram,
        user: wallet.publicKey,
        //mint: nftValues.nft1,
        stakeAccount: values.stakeAccounts[0],
      }).rpc({ commitment: "confirmed" });
    //const newWalletBalance = await connection.getBalance(wallet.publicKey, "confirmed"); 
    //this can't be used to check the account closing
    //expect(newWalletBalance).to.be.greaterThan(walletBalance);

    //check account closing
    const vault = await connection.getAccountInfo(values.vaults[0], "confirmed");
    expect(vault).to.be.null;
    const stakeAccount = await connection.getAccountInfo(values.stakeAccounts[0], "confirmed");
    expect(stakeAccount).to.be.null;

    const newUserAccountData = await program.account.userAccount.fetch(values.userAccount, "confirmed");
    console.log("newUserAccountData:", newUserAccountData);
    expect(newUserAccountData.amountStaked).to.be.greaterThan(0);
    expect(newUserAccountData.amountStaked).to.be.equal(userAccountData.amountStaked - 1);
    expect(newUserAccountData.points).to.be.greaterThan(userAccountData.points);

  });
});
