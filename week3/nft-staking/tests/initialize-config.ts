import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { createValues, ITestValues } from "./util";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("nft-staking", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.nftStaking as Program<NftStaking>;
  const { connection, wallet } = program.provider;

  let values: ITestValues;

  beforeEach(async () => {
    values = createValues();
    //airdrop the admin
    const recentBlockhash = await connection.getLatestBlockhash("confirmed");
    const airdropTx = await connection.requestAirdrop(values.admin.publicKey, 100 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction({ blockhash: recentBlockhash.blockhash, lastValidBlockHeight: recentBlockhash.lastValidBlockHeight, signature: airdropTx }, "confirmed");
  })

  it("Initialize Config", async () => {
    const freezePeriod = 60 * 60 * 24 * 30 * 6;
    const recentBlockhash = await connection.getLatestBlockhash("confirmed");
    const tx = await program.methods.initializeConfig(120, 3, freezePeriod)
      .accounts({
        admin: values.admin.publicKey,
        tokenProgram: values.tokenProgram
      }).signers([values.admin]).rpc();
    await connection.confirmTransaction({ blockhash: recentBlockhash.blockhash, lastValidBlockHeight: recentBlockhash.lastValidBlockHeight, signature: tx }, "confirmed");

    const configAccount = await program.account.config.fetch(values.config, "confirmed");
    console.log("configAccount", configAccount);
    expect(configAccount.freezePeriod).to.be.equal(freezePeriod);
    expect(configAccount.pointsPerStake).to.be.equal(120);
    expect(configAccount.maxUnstake).to.be.equal(3);
  });
});
