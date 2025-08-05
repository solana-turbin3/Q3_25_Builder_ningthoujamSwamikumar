import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { createValues, ITestValues } from "./util";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("initialize user", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.nftStaking as Program<NftStaking>;
  const { connection, wallet } = program.provider;

  let values: ITestValues;

  beforeEach(async () => {
    values = createValues({}, wallet.publicKey);
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
  })

  it("initialize user", async () => {
    await program.methods.initializeUser()
      .accounts({
        user: wallet.publicKey
      }).rpc();

    const userAccount = await program.account.userAccount.fetch(values.userAccount);
    console.log("userAccount", userAccount);
    expect(userAccount.amountStaked).to.be.equal(0);
    expect(userAccount.points).to.be.equal(0);
  });
});
