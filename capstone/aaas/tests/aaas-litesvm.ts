import { Keypair, PublicKey, type Signer, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { LiteSVM, SimulatedTransactionInfo } from "litesvm";
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import * as anchor from "@coral-xyz/anchor";
import type { Aaas } from "../target/types/aaas.ts";
import { ASSOCIATED_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token.js";
import { createInitializeMintInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync, MINT_SIZE } from "@solana/spl-token";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe.only("aaas with litesvm", () => {
  //const programId = PublicKey.unique();
  const program = anchor.workspace.aaas as anchor.Program<Aaas>;
  const programId = program.programId;
  const svm = new LiteSVM();
  svm.addProgramFromFile(programId, join(__dirname, "../target/deploy/aaas.so"));
  const payer = new Keypair();
  svm.airdrop(payer.publicKey, BigInt(100_000_000));
  const usdcMint = new Keypair();


  let multiSigners: Keypair[] = [];

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
    console.log("create usdc mint account: ", res);
  })

  it("is initialized with manual inxn", async () => {
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
          { isSigner: true, isWritable: false, pubkey: multiSigners[0].publicKey },
          { isSigner: true, isWritable: false, pubkey: multiSigners[1].publicKey },
        ],
        programId,
        data
      }
    );
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = svm.latestBlockhash();

    tx.sign(payer, multiSigners[0], multiSigners[1]);

    const res = svm.simulateTransaction(tx);
    console.log("manual insn simulation", res);
    console.log(res.meta().logs());
  })

  it.only("initialized!", async () => {
    //const tx = new Transaction();
    const tx = await program.methods.initialize(multiSigners.map(ms => ms.publicKey), 2)
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
        usdcMint: usdcMint.publicKey,
        admin: payer.publicKey,
      })
      .remainingAccounts(
        [
          { isSigner: true, isWritable: true, pubkey: multiSigners[1].publicKey },
          { isSigner: true, isWritable: true, pubkey: multiSigners[2].publicKey }
        ]
      )
      .transaction();
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(payer, multiSigners[1], multiSigners[2]); //tx fee payer
    try {
      const res = svm.sendTransaction(tx);
      console.log("res:", res);
    } catch (err) {
      console.error("Transaction failed:", err.logs ?? err);
    }

    // const usdcAccount = svm.getAccount(usdcMint.publicKey);
    // console.log("usdcAccount:", usdcAccount);

    const configAccount = svm.getAccount(PublicKey.findProgramAddressSync([Buffer.from("aaasConfig")], programId)[0]);
    console.log("configAccount:", configAccount);
  })

})

