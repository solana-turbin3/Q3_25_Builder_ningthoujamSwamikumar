import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { FailedTransactionMetadata, LiteSVM } from "litesvm";
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as anchor from "@coral-xyz/anchor";
import type { Aaas } from "../target/types/aaas.ts";
import { ASSOCIATED_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token.js";
import { createInitializeMintInstruction, getAssociatedTokenAddressSync, MINT_SIZE } from "@solana/spl-token";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system.js";
import { expect } from "chai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type AaasConfig = anchor.IdlAccounts<Aaas>["aaasConfig"];

describe.only("aaas with litesvm", () => {
  const program = anchor.workspace.aaas as anchor.Program<Aaas>;
  const programId = program.programId; //program id has to be the one created by anchor, can't use random public key
  const svm = new LiteSVM();
  svm.addProgramFromFile(programId, join(__dirname, "../target/deploy/aaas.so"));
  const payer = new Keypair();
  svm.airdrop(payer.publicKey, BigInt(100_000_000));
  const usdcMint = new Keypair();

  let multiSigners: Keypair[] = [];
  let serviceId: PublicKey;

  before(async () => {
    multiSigners.push(payer);
    multiSigners.push(new Keypair());
    multiSigners.push(new Keypair());
    multiSigners.push(new Keypair());
    multiSigners.push(new Keypair());

    //create usdc mint account
    const lamports = svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE));
    const createUsdcMintTx = new Transaction().add(
      SystemProgram.createAccount(
        {
          fromPubkey: payer.publicKey,
          lamports: Number(lamports),
          newAccountPubkey: usdcMint.publicKey,
          programId: TOKEN_PROGRAM_ID,
          space: MINT_SIZE
        }
      )
    ).add(
      createInitializeMintInstruction(usdcMint.publicKey, 6, payer.publicKey, null, TOKEN_PROGRAM_ID)
    );
    createUsdcMintTx.recentBlockhash = svm.latestBlockhash();
    createUsdcMintTx.sign(payer, usdcMint);
    const res = svm.sendTransaction(createUsdcMintTx);
    console.log("create usdc mint account ✔️:", res);

    serviceId = PublicKey.unique();
  })

  it.skip("is initialized with manual inxn", async () => {
    const data = program.coder.instruction.encode("initialize",
      { signers: multiSigners.map(ms => ms.publicKey), threshold: 2 }
    );
    const ix = new TransactionInstruction(
      {
        keys: [
          { isSigner: true, isWritable: true, pubkey: payer.publicKey },
          { isSigner: false, isWritable: true, pubkey: PublicKey.findProgramAddressSync([Buffer.from("aaasConfig")], programId)[0] },
          { isSigner: false, isWritable: true, pubkey: getAssociatedTokenAddressSync(usdcMint.publicKey, payer.publicKey) },
          { isSigner: false, isWritable: false, pubkey: usdcMint.publicKey },
          { isSigner: false, isWritable: false, pubkey: SYSTEM_PROGRAM_ID },
          { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID },
          { isSigner: false, isWritable: false, pubkey: ASSOCIATED_PROGRAM_ID },
          //remaining accounts
          { isSigner: true, isWritable: false, pubkey: multiSigners[0].publicKey },  //even if the is_signer is false, and they are added in sign(..), then solana runtime sets is_signer to true
          { isSigner: false, isWritable: false, pubkey: multiSigners[1].publicKey },
        ],
        programId,
        data
      }
    );
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = svm.latestBlockhash();

    tx.sign(payer, multiSigners[1], multiSigners[0]); //order doesn't need to same to the order in the accounts

    const res = svm.simulateTransaction(tx);
    console.log("initialization using manual ixn:", res.meta().logs());
  })

  it("initialized!", async () => {
    const tx = await program.methods.initialize(multiSigners.map(ms => ms.publicKey), 2)
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
        usdcMint: usdcMint.publicKey,
        admin: payer.publicKey,
      })
      .remainingAccounts(
        [
          { isSigner: true, isWritable: false, pubkey: multiSigners[1].publicKey },
          { isSigner: true, isWritable: false, pubkey: multiSigners[2].publicKey }
        ]
      )
      .transaction();
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(payer, multiSigners[1], multiSigners[2]); //tx fee payer 

    const res = svm.sendTransaction(tx);
    if (res instanceof FailedTransactionMetadata) throw new Error("Expected successfull send transaction!");

    const configAccount = svm.getAccount(PublicKey.findProgramAddressSync([Buffer.from("aaasConfig")], programId)[0]);
    if (!configAccount) throw new Error("Expected valid configAccount!");

    const decodedConfigAccount = program.coder.accounts.decode("aaasConfig", Buffer.from(configAccount?.data)) as AaasConfig;
    expect(decodedConfigAccount.admin.toBase58()).to.be.equal(payer.publicKey.toBase58());
    console.log("Expectation✅ - config account presents expected admin!");
    expect(decodedConfigAccount.signers.map(s => s.toBase58()))
      .to.have.members(multiSigners.map(ms => ms.publicKey.toBase58()));
    console.log("Expectation✅ - config account has signers with multisigners as member");
    expect(decodedConfigAccount.threshold).to.be.equal(2);
    console.log("Expectation✅ - config account has provided threshold value");
  })

  it("Is Service Initialized!", async () => {
    program.methods.initializeService(serviceId, 300)
    .accounts({
      initializer: payer.publicKey,
      
    })
  })

})

