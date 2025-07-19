import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { Account, ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getAccount, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, Mint, mintTo, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";


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
  //let offer: anchor.web3.PublicKey;

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
      100 * offerMintDecimals,
      [],
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    const offerAmnt = new anchor.BN(10);
    const askAmnt = new anchor.BN(20);

    const tx = await program.methods
      .initialize(new anchor.BN(offerId), offerAmnt, askAmnt)
      .accountsPartial({
        askMint: askMintAddr,
        offerMint: offerMintAddr,
        initializer: wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });

    console.log("initiate tx successfull!", tx);

    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: tx, ...latestBlockhash }, "confirmed");

    const txDetails = await connection.getParsedTransaction(tx, "confirmed");
    console.log(txDetails?.meta?.logMessages);

    const [offer, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("offer"), new anchor.BN(offerId).toArrayLike(Buffer, 'le', 8)],
      program.programId
    );

    const vaultAddr = await getAssociatedTokenAddress(
      offerMintAddr,
      offer,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    vault = await getAccount(connection, vaultAddr, undefined, TOKEN_2022_PROGRAM_ID);

    console.log("vault account:", vault);

    assert.ok(vault.mint.equals(offerMintAddr), "Unexpected vault mint");
    assert.strictEqual(vault.amount.toString(), offerAmnt.toString(), "Unexpected vault amount");
  });
});
