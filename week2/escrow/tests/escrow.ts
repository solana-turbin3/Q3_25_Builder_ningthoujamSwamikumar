import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { Account, createMint, getOrCreateAssociatedTokenAccount, Mint, mintTo, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";


describe("escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.escrow as Program<Escrow>;
  const { wallet, connection } = anchor.getProvider();
  const offerId = 1;

  let offerMintAddr: anchor.web3.PublicKey;
  let askMintAddr: anchor.web3.PublicKey;

  const offerMintDecimals = 4;
  const askMintDecimals = 4;

  let vault: Account;
  let offer: anchor.web3.PublicKey;

  it("initialized escrow", async () => {
    offerMintAddr = await createMint(
      connection,
      wallet.payer,
      wallet.payer.publicKey,
      wallet.publicKey,
      offerMintDecimals,
      undefined,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );
    console.log("offerMintAddr:", offerMintAddr);

    askMintAddr = await createMint(
      connection,
      wallet.payer,
      wallet.payer.publicKey,
      wallet.publicKey,
      askMintDecimals,
      undefined,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );
    console.log("askMintAddr:", askMintAddr);

    const offerMint = await connection.getAccountInfo(offerMintAddr);
    console.log("offerMint:", offerMint);

    const initializerAta = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      offerMintAddr,
      wallet.publicKey,
      null,
      null,
      null,
      TOKEN_2022_PROGRAM_ID
    );

    await mintTo(
      connection,
      wallet.payer,
      offerMintAddr,
      initializerAta.address,
      wallet.payer,
      100 * offerMintDecimals
    );

    // Add your test here.
    const tx = await program.methods.initialize(new anchor.BN(10), new anchor.BN(20), new anchor.BN(offerId))
      .accounts(
        {
          askMint: askMintAddr,
          offerMint: offerMintAddr,
          initializer: wallet.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID
        }
      )
      .rpc();

    console.log("initiate tx successfull!", tx);

    offer = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("offer"), new Uint8Array(offerId)],
      program.programId)[0];

    vault = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      offerMintAddr,
      offer
    );

    console.log("vault:", vault);

  });
});
