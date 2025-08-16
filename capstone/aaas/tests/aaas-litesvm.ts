import * as anchor from "@coral-xyz/anchor";
import { IdlAccounts, BN } from "@coral-xyz/anchor";
import { Aaas } from "../target/types/aaas";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, unpackAccount, AccountLayout } from "@solana/spl-token";
import { join } from "path";
import { createValues, ITestValues } from "./utils";

import { FailedTransactionMetadata, LiteSVM } from "litesvm";
import { expect } from "chai";

type AaasAccounts = IdlAccounts<Aaas>;

describe.only("aaas with litesvm", () => {
  const program = anchor.workspace.aaas as anchor.Program<Aaas>;
  const programId = program.programId; //program id has to be the one created by anchor, can't use random public key
  const svm = new LiteSVM();
  svm.addProgramFromFile(programId, join(__dirname, "../target/deploy/aaas.so"));

  let testValues: ITestValues;
  before(async () => {
    testValues = await createValues(svm, program);
  })

  it.skip("is initialized with manual inxn", async () => {
    const data = program.coder.instruction.encode("initialize",
      { signers: testValues.config.signers.map(ms => ms.publicKey), threshold: 2 }
    );
    const ix = new TransactionInstruction(
      {
        keys: [
          { isSigner: true, isWritable: true, pubkey: testValues.payer.publicKey },
          { isSigner: false, isWritable: true, pubkey: PublicKey.findProgramAddressSync([Buffer.from("aaasConfig")], programId)[0] },
          { isSigner: false, isWritable: true, pubkey: getAssociatedTokenAddressSync(testValues.usdcMint.publicKey, testValues.payer.publicKey) },
          { isSigner: false, isWritable: false, pubkey: testValues.usdcMint.publicKey },
          { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
          { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID },
          { isSigner: false, isWritable: false, pubkey: ASSOCIATED_TOKEN_PROGRAM_ID },
          //remaining accounts
          { isSigner: true, isWritable: false, pubkey: testValues.config.signers[0].publicKey },  //even if the is_signer is false, and they are added in sign(..), then solana runtime sets is_signer to true
          { isSigner: false, isWritable: false, pubkey: testValues.config.signers[1].publicKey },
        ],
        programId,
        data
      }
    );
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = svm.latestBlockhash();

    tx.sign(testValues.payer, testValues.config.signers[1], testValues.config.signers[0]); //order doesn't need to same to the order in the accounts

    const res = svm.simulateTransaction(tx);
    console.log("initialization using manual ixn:", res.meta().logs());
  })

  it("initialized!", async () => {
    const tx = await program.methods.initialize(testValues.config.signers.map(ms => ms.publicKey), 2)
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
        usdcMint: testValues.usdcMint.publicKey,
        admin: testValues.payer.publicKey,
      })
      .remainingAccounts(
        [
          { isSigner: true, isWritable: false, pubkey: testValues.config.signers[1].publicKey },
          { isSigner: true, isWritable: false, pubkey: testValues.config.signers[2].publicKey }
        ]
      )
      .transaction();
    tx.feePayer = testValues.payer.publicKey;
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(testValues.payer, testValues.config.signers[1], testValues.config.signers[2]); //tx fee testValues.payer 

    const res = svm.sendTransaction(tx);
    if (res instanceof FailedTransactionMetadata) throw new Error("Expected successfull send transaction!");

    const configAccount = svm.getAccount(testValues.config.key);
    if (!configAccount) throw new Error("Expected valid configAccount!");

    const decodedConfigAccount = program.coder.accounts.decode<AaasAccounts["aaasConfig"]>("aaasConfig", Buffer.from(configAccount?.data));
    expect(decodedConfigAccount.admin.toBase58()).to.be.equal(testValues.payer.publicKey.toBase58());
    console.log("Expectation✅ - config account presents expected admin!");
    expect(decodedConfigAccount.signers.map(s => s.toBase58()))
      .to.have.members(testValues.config.signers.map(ms => ms.publicKey.toBase58()));
    console.log("Expectation✅ - config account has signers with multisigners as member");
    expect(decodedConfigAccount.threshold).to.be.equal(2);
    console.log("Expectation✅ - config account has provided threshold value");
  })

  it("Is Service Initialized!", async () => {
    const tx = await program.methods.initializeService(testValues.service.id, testValues.service.fee)
      .accounts({
        initializer: testValues.payer.publicKey,
        //@ts-ignore
        config: testValues.config.key,
      }).remainingAccounts([
        { isSigner: true, isWritable: false, pubkey: testValues.config.signers[0].publicKey },
        { isSigner: true, isWritable: false, pubkey: testValues.config.signers[3].publicKey },
      ])
      //.signers([testValues.payer, testValues.config.signers[0], testValues.config.signers[3]]) //this is just defining metadata - what are the keypairs which will sign the tx, actual sign will be call when rpc or simulate method is called
      .transaction();

    tx.recentBlockhash = svm.latestBlockhash();
    //tx.feePayer = testValues.payer.publicKey; //by default the first keypair will be the fee payer in sign(...)
    tx.sign(testValues.payer, testValues.config.signers[0], testValues.config.signers[3]);

    // const res = svm.simulateTransaction(tx); //use simulate to find logs
    // console.log(res.meta().logs());

    const res = svm.sendTransaction(tx); //actual transaction, doesn't give logs as of this litesvm version
    if (res instanceof FailedTransactionMetadata) throw new Error("Expected Successfull transaction!");

    const serviceAccount = svm.getAccount(testValues.service.key);
    if (!serviceAccount) throw new Error("Expected valid service account!");

    const decodedServiceAccountData = program.coder.accounts.decode<AaasAccounts["service"]>("service", Buffer.from(serviceAccount.data));
    expect(decodedServiceAccountData.fee).to.be.equal(testValues.service.fee);
    expect(decodedServiceAccountData.id.toBase58()).to.be.equal(testValues.service.id.toBase58());
    console.log("Expectation✅ - service account have expected fee, and id values");
  })

  it("is challenge created!", async () => {
    const { id, endTime, startTime, stakeAmnt, key, proof, winningThreshold, vault, creator } = testValues.challenge;
    const tx = await program.methods.createChallenge(id, startTime, endTime, new BN(stakeAmnt), proof, winningThreshold)
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
        usdcMint: testValues.usdcMint.publicKey,
        creator: creator.publicKey,
        //@ts-ignore
        service: testValues.service.key,
      }).transaction();

    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(creator);

    const sim = svm.simulateTransaction(tx);
    console.log(sim.meta().logs());

    const res = svm.sendTransaction(tx);
    if (res instanceof FailedTransactionMetadata) throw new Error("Expected successfull create challenge!");

    const vaultAccountInfo = svm.getAccount(vault);
    expect(vaultAccountInfo).to.be.not.null;
    const challengeAccountInfo = svm.getAccount(key);
    expect(challengeAccountInfo).to.be.not.null;
    console.log("Expectation✅ - vault and challenge accounts are exist");

    const challengeAccount = program.coder.accounts.decode<AaasAccounts["challenge"]>(
      "challenge", Buffer.from(challengeAccountInfo!.data)
    );
    expect(challengeAccount.candidateCount).to.be.equal(0);
    expect(challengeAccount.winnerCount).to.be.equal(0);
    expect(challengeAccount.endTime.toString()).to.be.equal(endTime.toString());
    expect(challengeAccount.stakeAmnt.toNumber()).to.be.equal(stakeAmnt);
    console.log("Expectation✅ - challenge fields are as expected");
  })

  it("should join challenge!", async () => {
    const tx = await program.methods.joinChallenge()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
        usdcMint: testValues.usdcMint.publicKey,
        candidate: testValues.candidate.payer.publicKey,
        challenge: testValues.challenge.key, //just passing challenge is not enough to derive both challenge, and candidateAccount PDAs
        candidateAccount: testValues.candidate.account, //this is needed as 
      }).transaction();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(testValues.candidate.payer);

    console.log("Join challenge tx:", tx);

    const sim = svm.simulateTransaction(tx);
    console.log(sim.meta().logs());

    const res = svm.sendTransaction(tx);
    if (res instanceof FailedTransactionMetadata) throw new Error("Expected join challenge to be successful!");

    const candidateInfo = svm.getAccount(testValues.candidate.account);
    expect(candidateInfo).to.be.not.null;

    const candidateAccount = program.coder.accounts.decode<AaasAccounts["candidateAccount"]>(
      "candidateAccount", Buffer.from(candidateInfo?.data!));
    expect(candidateAccount.acceptance).to.be.equal(0);
    expect(candidateAccount.candidate.toBase58()).to.be.equal(testValues.candidate.payer.publicKey.toBase58());
    expect(candidateAccount.proof).to.be.equal("");
    expect(candidateAccount.rewarded).to.be.false;
    console.log("Expectation✅ - candidate account has expected values");

    const vaultInfo = svm.getAccount(testValues.challenge.vault);
    const vaultAccount = AccountLayout.decode(Buffer.from(vaultInfo?.data!));
    expect(Number(vaultAccount.amount)).to.be.equal(testValues.challenge.stakeAmnt);
    console.log("Expectation✅ - vault has expected staked amount");

    const challengeInfo = svm.getAccount(testValues.challenge.key);
    const challengeAccount = program.coder.accounts.decode<AaasAccounts["challenge"]>(
      "challenge", Buffer.from(challengeInfo?.data!));
    expect(challengeAccount.candidateCount).to.be.equal(1);
    console.log("Expectation✅ - Challenge account is updated as expected");
  })

})

