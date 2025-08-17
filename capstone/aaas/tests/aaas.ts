import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import type { Aaas } from "../target/types/aaas.ts";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("aaas", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.aaas as Program<Aaas>;
  const { connection, wallet } = program.provider;

  let multiSigners: Keypair[];
  let usdcMint: PublicKey;

  before(async () => {
    multiSigners = [new Keypair(), new Keypair(), new Keypair()];
    usdcMint = await createMint(connection, wallet?.payer!, wallet?.publicKey!, null, 6);
  })

  it("Is initialized!", async () => {
    const tx = await program.methods.initialize(
      [multiSigners[0].publicKey, multiSigners[1].publicKey, multiSigners[2].publicKey],
      2
    ).accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
      usdcMint,
      admin: wallet?.publicKey
    }).remainingAccounts(
      [
        { isSigner: true, isWritable: false, pubkey: multiSigners[0].publicKey },
        { isSigner: true, isWritable: false, pubkey: multiSigners[1].publicKey }
      ]
    ).signers([wallet?.payer!, multiSigners[0], multiSigners[1]])
      .rpc();
  });
});
