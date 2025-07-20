import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { Account, ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getAccount, getAssociatedTokenAddress, getMint, getOrCreateAssociatedTokenAccount, Mint, mintTo, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";

const ASSOCIATED_TOKEN_2022_PROGRAM_ID = new anchor.web3.PublicKey("9W5GgxG42U9J5NdA4xj7Hb7sEvM2kQEP7RHNd5VFFPZN");

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
  let offerBump: number;

  let offerAmnt: anchor.BN;
  let askAmnt: anchor.BN;

  it("initialized offer", async () => {
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
    //console.log("offerMintAddr:", offerMintAddr);

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
    //console.log("askMintAddr:", askMintAddr);

    const offerMint = await connection.getAccountInfo(offerMintAddr);
    //console.log("offerMint:", offerMint);

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

    const initializerRecievingAta = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      askMintAddr,
      wallet.publicKey,
      null,
      null,
      null,
      TOKEN_2022_PROGRAM_ID
    );
    //console.log("testing ata create or get");

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

    offerAmnt = new anchor.BN(10);
    askAmnt = new anchor.BN(20);

    const tx = await program.methods
      .initialize(new anchor.BN(offerId), offerAmnt, askAmnt)
      .accountsPartial({
        askMint: askMintAddr,
        offerMint: offerMintAddr,
        initializer: wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });

    //console.log("initiate tx successfull!", tx);

    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: tx, ...latestBlockhash }, "confirmed");

    const txDetails = await connection.getParsedTransaction(tx, "confirmed");
    //console.log(txDetails?.meta?.logMessages);

    [offer, offerBump] = anchor.web3.PublicKey.findProgramAddressSync(
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

    //console.log("vault account:", vault);

    assert.ok(vault.mint.equals(offerMintAddr), "Unexpected vault mint");
    assert.strictEqual(vault.amount.toString(), offerAmnt.toString(), "Unexpected vault amount");
  });

  it("accept offer", async () => {
    const offerAccnt = await program.account.offer.fetch(offer);

    //console.log("offerAccount:", offerAccnt);

    const keypair = anchor.web3.Keypair.generate();
    const airdropTx = await connection.requestAirdrop(keypair.publicKey, 1 * Math.pow(10, 9));
    const recentBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      {
        blockhash: recentBlockhash.blockhash,
        lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
        signature: airdropTx
      },
      "confirmed"
    );

    const acceptorsBal = await connection.getBalance(keypair.publicKey);
    //console.log("acceptor balance", acceptorsBal);

    const askMintAccntInfo = await getMint(connection, askMintAddr, "confirmed", TOKEN_2022_PROGRAM_ID);
    //console.log("ask mint account info", askMintAccntInfo);

    //console.log("wallet pubkey:", wallet.publicKey);

    const initializerRecievingAta = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      askMintAddr,
      keypair.publicKey,
      null,
      null,
      null,
      TOKEN_2022_PROGRAM_ID
    );
    //console.log("testing ata create or get");

    const acceptorsSendingAta = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      askMintAddr,
      keypair.publicKey,
      null,
      "confirmed",
      null,
      TOKEN_2022_PROGRAM_ID
    );

    //console.log("acceptors's asked ata:", acceptorsSendingAta);

    await mintTo(
      connection,
      wallet.payer,
      askMintAddr,
      acceptorsSendingAta.address,
      wallet.payer,
      100 * Math.pow(10, askMintAccntInfo.decimals),
      undefined,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    //console.log("asked token minted to acceptors asked ata");

    const tx = await program.methods.accept(new anchor.BN(offerId))
      .accounts(
        {
          acceptor: keypair.publicKey,
          askedMint: askMintAddr,
          initializer: offerAccnt.user,
          offeredMint: offerMintAddr,
          tokenProgram: TOKEN_2022_PROGRAM_ID
        }
      )
      .signers([keypair])
      .rpc();

    console.log(`tx success - ${tx}`);
  })
});
