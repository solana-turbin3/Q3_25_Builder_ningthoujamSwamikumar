import * as anchor from "@coral-xyz/anchor";
import { IdlAccounts, BN } from "@coral-xyz/anchor";
import { Aaas } from "../target/types/aaas";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";
import { join } from "path";
import { createValues, generateCandidate, initCandidateAta, ITestValues, joinChallengeWithNewCandidate, setClock, submitProof, validateProof } from "./utils";

import { FailedTransactionMetadata, LiteSVM, SimulatedTransactionInfo, TransactionMetadata } from "litesvm";
import { expect } from "chai";

type AaasAccounts = IdlAccounts<Aaas>;

describe.only("aaas with litesvm", () => {
  const program = anchor.workspace.aaas as anchor.Program<Aaas>;
  const programId = program.programId; //program id has to be the one created by anchor, can't use random public key
  const svm = new LiteSVM();
  svm.addProgramFromFile(programId, join(__dirname, "../target/deploy/aaas.so"));

  let testValues: ITestValues;
  let candidates: [Keypair, PublicKey][] = [];
  before(async () => {
    testValues = await createValues(svm, program);
  })

  it("initialized!", async () => {
    const tx = await program.methods.initialize(testValues.config.signers.map(ms => ms.publicKey), 2)
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
        usdcMint: testValues.usdcMint.publicKey,
        admin: testValues.admin.publicKey,
      })
      .remainingAccounts(
        [
          { isSigner: true, isWritable: false, pubkey: testValues.config.signers[1].publicKey },
          { isSigner: true, isWritable: false, pubkey: testValues.config.signers[2].publicKey }
        ]
      )
      .transaction();
    tx.feePayer = testValues.admin.publicKey;
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(testValues.admin, testValues.config.signers[1], testValues.config.signers[2]); //tx fee testValues.payer 

    const res = svm.sendTransaction(tx);
    if (res instanceof FailedTransactionMetadata) throw new Error("Expected successfull send transaction!");

    const configAccount = svm.getAccount(testValues.config.key);
    if (!configAccount) throw new Error("Expected valid configAccount!");

    const decodedConfigAccount = program.coder.accounts.decode<AaasAccounts["aaasConfig"]>("aaasConfig", Buffer.from(configAccount?.data));
    expect(decodedConfigAccount.admin.toBase58()).to.be.equal(testValues.admin.publicKey.toBase58());
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
        initializer: testValues.admin.publicKey,
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
    tx.sign(testValues.admin, testValues.config.signers[0], testValues.config.signers[3]);

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
        //@ts-ignore
        challenge: testValues.challenge.key, //just passing challenge is not enough to derive both challenge, and candidateAccount PDAs
        candidateAccount: testValues.candidate.account, //this is needed as anchor will need to go to depth 2 as it first need to derive the pda for challlenge 
      }).transaction();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(testValues.candidate.payer);

    //console.log("Join challenge tx:", tx);

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

    //add candidate to candidates list
    candidates.push([testValues.candidate.payer, testValues.candidate.account]);
  })

  it("shouldn't join challenge!", async () => {
    //set time after the start time and join
    const newClock = svm.getClock();
    console.log("time: ", newClock.unixTimestamp);
    newClock.unixTimestamp = BigInt(testValues.challenge.startTime.toString(10));
    svm.setClock(newClock);
    console.log("new time: ", svm.getClock().unixTimestamp);

    const [candidate, candidateAccount] = generateCandidate(
      svm, testValues.service.key, testValues.challenge.key, program.programId);
    await initCandidateAta(testValues.usdcMint, candidate, svm, testValues.admin);

    const tx = await program.methods.joinChallenge()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
        usdcMint: testValues.usdcMint.publicKey,
        candidate: candidate.publicKey,
        //@ts-ignore
        challenge: testValues.challenge.key, //just passing challenge is not enough to derive both challenge, and candidateAccount PDAs
        candidateAccount, //this is needed as 
      }).transaction();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(candidate);

    const sim = svm.simulateTransaction(tx);
    expect(sim.meta().logs().some(log => log.includes("ChallengeStarted"))).to.be.true;

    const res = svm.sendTransaction(tx);
    expect(res).to.be.instanceOf(FailedTransactionMetadata);

    const candidateAccountInfo = svm.getAccount(candidateAccount);
    expect(candidateAccountInfo).to.be.null;

    //reset clock to original
    const resetClock = svm.getClock();
    resetClock.unixTimestamp = BigInt(0);
    svm.setClock(resetClock);
  })

  it("should exit challenge!", async () => {
    const [candidate, candidateAccount] = await joinChallengeWithNewCandidate(svm, testValues, program);

    const challengeAccount = program.coder.accounts.decode<AaasAccounts["challenge"]>(
      "challenge", Buffer.from(svm.getAccount(testValues.challenge.key)?.data!));
    const candidateBal = svm.getBalance(testValues.candidate.payer.publicKey);

    const tx = await program.methods.exitChallenge()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
        usdcMint: testValues.usdcMint.publicKey,
        //@ts-ignore
        candidate: candidate.publicKey,
        challenge: testValues.challenge.key,
        candidateAccount,
      }).transaction();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(candidate);

    const sim = svm.simulateTransaction(tx);
    console.log(sim.meta().logs());

    const res = svm.sendTransaction(tx);
    expect(res).to.be.instanceOf(TransactionMetadata);

    const candidateAccountInfo = svm.getAccount(candidateAccount);
    //console.log("candidateAccountInfo:", candidateAccountInfo);
    expect(candidateAccountInfo?.data.length).to.be.equal(0);

    const updatedChallengeAccount = program.coder.accounts.decode<AaasAccounts["challenge"]>(
      "challenge", Buffer.from(svm.getAccount(testValues.challenge.key)?.data!));
    expect(updatedChallengeAccount.candidateCount).to.be.equal(challengeAccount.candidateCount - 1);

    const newCandidateBal = svm.getBalance(candidate.publicKey);
    console.log("candidateBal:", candidateBal, " & newCandidateBal:", newCandidateBal);
    //can't rely on the balance as the transaction fee could be larger the refunded fee
    //expect(new BN(newCandidateBal!.toString(10)).lt(new BN(candidateBal!.toString(10)))).to.be.true;
  })

  it("shouldn't exit challenge if the challenge is started!", async () => {
    const [candidate, candidateAccount] = await joinChallengeWithNewCandidate(svm, testValues, program);

    //set the time to a value after challenge start time
    let clock = svm.getClock();
    console.log("time in shouldn't exit challenge: ", clock.unixTimestamp);
    clock.unixTimestamp = BigInt(Number(testValues.challenge.startTime.add(new BN(1000))));
    svm.setClock(clock);
    console.log("new time in shouldn't exit challenge: ", svm.getClock().unixTimestamp);

    const tx = await program.methods.exitChallenge()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
        usdcMint: testValues.usdcMint.publicKey,
        //@ts-ignore
        candidate: candidate.publicKey,
        candidateAccount,
        challenge: testValues.challenge.key
      }).transaction();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(candidate);

    const sim = svm.simulateTransaction(tx);
    console.log(sim.meta().logs());
    expect(sim.meta().logs().some(log => log.includes("ChallengeStarted"))).to.be.true;
    const res = svm.sendTransaction(tx);
    expect(res).to.be.instanceOf(FailedTransactionMetadata);

    const candidateAccountInfo = svm.getAccount(testValues.candidate.account);
    expect(candidateAccountInfo?.owner.toBase58()).to.be.equal(program.programId.toBase58());

    //reset clock
    const reset = svm.getClock();
    reset.unixTimestamp = BigInt(0);
    svm.setClock(reset);

    //add to candidates
    candidates.push([candidate, candidateAccount]);
  })

  it("should submit proof and shouldn't resubmit!", async () => {
    //set time inside challenge duration
    let clock = svm.getClock();
    clock.unixTimestamp = BigInt(testValues.challenge.startTime.add(new BN(100)).toString(10));
    svm.setClock(clock);

    const proof = "http://linkt/to/proof";
    const tx = await program.methods.submitProof(proof)
      .accounts({
        challenge: testValues.challenge.key,
        candidate: testValues.candidate.payer.publicKey,
        candidateAccount: testValues.candidate.account
      }).transaction();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(testValues.candidate.payer);
    const sim = svm.simulateTransaction(tx);
    console.log(sim.meta().logs());
    const res = svm.sendTransaction(tx);
    expect(res).to.be.instanceOf(TransactionMetadata);

    const candidateAccountInfo = svm.getAccount(testValues.candidate.account);
    const candidateAccount = program.coder.accounts.decode<AaasAccounts["candidateAccount"]>(
      "candidateAccount", Buffer.from(candidateAccountInfo?.data!));
    expect(candidateAccount.proof).to.be.equal(proof);
    console.log("Expectations✅ - submitted proof as expected");

    //set time to just before the challenge ends
    clock.unixTimestamp = BigInt(testValues.challenge.endTime.toNumber() - 1000);
    svm.setClock(clock);
    console.log("clock set, for shouldn't resubmit case, to ", svm.getClock().unixTimestamp);

    const newProof = "https://new/proof/link"
    const resubmitTx = await program.methods.submitProof(newProof)
      .accounts({
        challenge: testValues.challenge.key,
        candidate: testValues.candidate.payer.publicKey,
        candidateAccount: testValues.candidate.account
      }).transaction();
    resubmitTx.recentBlockhash = svm.latestBlockhash();
    resubmitTx.sign(testValues.candidate.payer);
    const resubmitSim = svm.simulateTransaction(resubmitTx);
    console.log(resubmitSim.meta().logs());
    expect(resubmitSim.meta().logs().some(log => log.includes("DuplicateProof"))).to.be.true;
    const resubmitRes = svm.sendTransaction(resubmitTx);
    expect(resubmitRes).to.be.instanceOf(FailedTransactionMetadata);

    const resubmitCandidateAccountInfo = svm.getAccount(testValues.candidate.account);
    const resubmitCandidateAccount = program.coder.accounts.decode<AaasAccounts["candidateAccount"]>(
      "candidateAccount", Buffer.from(resubmitCandidateAccountInfo?.data!));
    expect(resubmitCandidateAccount.proof).to.be.equal(proof);
    console.log("Expectations✅ - Resubmit proof is as expected");

    //reset clock
    clock.unixTimestamp = BigInt(0);
    svm.setClock(clock);
  })

  it("shouldn't submit proof before challenge duration", async () => {
    const [candidate, candidateAccount] = await joinChallengeWithNewCandidate(svm, testValues, program);
    const proof = "https://some/link/to/proof";
    //clock is at reset or 0
    const earlyTx = await program.methods.submitProof(proof)
      .accounts({
        challenge: testValues.challenge.key,
        candidate: candidate.publicKey,
        candidateAccount
      }).transaction();
    earlyTx.recentBlockhash = svm.latestBlockhash();
    earlyTx.sign(candidate);

    const earlySim = svm.simulateTransaction(earlyTx);
    console.log(earlySim.meta().logs());
    expect(earlySim.meta().logs().some(log => log.includes("ChallengeNotStarted")));

    const earlyRes = svm.sendTransaction(earlyTx);
    expect(earlyRes).to.be.instanceOf(FailedTransactionMetadata);

    const candidateAccountData = program.coder.accounts.decode<AaasAccounts["candidateAccount"]>(
      "candidateAccount", Buffer.from(svm.getAccount(candidateAccount)?.data!));
    expect(candidateAccountData.proof).to.be.empty;
    expect(candidateAccountData.acceptance).to.be.equal(0);
    console.log("Expectations✅ - proof submit is failed before challenge started");

    //add to candidates
    candidates.push([candidate, candidateAccount]);
  })

  it("shouldn't submit proof after challenge duration", async () => {
    const [candidate, candidateAccount] = await joinChallengeWithNewCandidate(svm, testValues, program);
    const proof = "https://some/link/to/proof";

    //set clock after challenge
    let clock = svm.getClock();
    clock.unixTimestamp = BigInt(testValues.challenge.endTime.toNumber() + 100);
    svm.setClock(clock);
    console.log("in shouldn't submit proof, set clock at:", svm.getClock().unixTimestamp);

    const afterTx = await program.methods.submitProof(proof)
      .accounts({
        challenge: testValues.challenge.key,
        candidate: candidate.publicKey,
        candidateAccount
      }).transaction();
    afterTx.recentBlockhash = svm.latestBlockhash();
    afterTx.sign(candidate);

    const afterSim = svm.simulateTransaction(afterTx);
    console.log(afterSim.meta().logs());
    expect(afterSim.meta().logs().some(log => log.includes("ChallengeEnded")));

    const afterRes = svm.sendTransaction(afterTx);
    expect(afterRes).to.be.instanceOf(FailedTransactionMetadata);

    const candidateAccountDataAfter = program.coder.accounts.decode<AaasAccounts["candidateAccount"]>(
      "candidateAccount", Buffer.from(svm.getAccount(candidateAccount)?.data!));
    expect(candidateAccountDataAfter.proof).to.be.empty;
    expect(candidateAccountDataAfter.acceptance).to.be.equal(0);

    //add to candidate list
    candidates.push([candidate, candidateAccount]);
  })

  it("should validate proof!", async () => {
    const validator = testValues.candidate.payer;
    const nonValidator = candidates.find(cand => !cand[0].publicKey.equals(validator.publicKey));
    const [candidate, candidateAccount] = generateCandidate(svm, testValues.service.key, testValues.challenge.key, programId, nonValidator?.[0]);
    //submit_proof for the candidate
    //set time before challenge end
    setClock(svm, BigInt(testValues.challenge.endTime.toNumber() - 1000));
    await submitProof(svm, program, testValues.challenge.key, candidate, candidateAccount);
    const validation = PublicKey.findProgramAddressSync([Buffer.from("aaasValidation"), testValues.service.key.toBuffer(), testValues.challenge.key.toBuffer(), candidateAccount.toBuffer(), validator.publicKey.toBuffer()], program.programId)[0];

    //set time after challenge but should be within validation period
    setClock(svm, BigInt(testValues.challenge.endTime.toNumber() + 500));
    const tx = await program.methods.validateProof()
      .accounts({
        validator: validator.publicKey,
        //@ts-ignore
        challenge: testValues.challenge.key,
        validatorAccount: testValues.candidate.account,
        candidateAccount,
        validation,
      }).transaction();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(validator);

    const sim = svm.simulateTransaction(tx);
    console.log(sim.meta().logs());
    expect(sim).to.be.instanceOf(SimulatedTransactionInfo);

    const res = svm.sendTransaction(tx);
    expect(res).to.be.instanceOf(TransactionMetadata);

    const candidateAccData = program.coder.accounts.decode<AaasAccounts["candidateAccount"]>(
      "candidateAccount", Buffer.from(svm.getAccount(candidateAccount)?.data!));
    expect(candidateAccData.acceptance).to.be.greaterThan(0);
    console.log("Expectation✅ - validated proof as expected!");
  })

  it("shouldn't validate proof, after validation period", async () => {
    setClock(svm, BigInt(0));
    console.log("time at start:", svm.getClock().unixTimestamp);

    const [candidate, candidateAccount] = await joinChallengeWithNewCandidate(svm, testValues, program);

    setClock(svm, BigInt(testValues.challenge.endTime.toNumber() - 500));
    console.log("time at submit proof:", svm.getClock().unixTimestamp);

    await submitProof(svm, program, testValues.challenge.key, candidate, candidateAccount);

    //set clock after validation period i.e. end_time + 24 hrs
    setClock(svm, BigInt(testValues.challenge.endTime.toNumber() + (60 * 60 * 24) + 100));
    console.log("time at validate proof:", svm.getClock().unixTimestamp);

    const [sim, res] = await validateProof(svm, testValues, testValues.candidate.payer, candidateAccount, program);
    console.log(sim.meta().logs());

    expect(res).to.be.instanceOf(FailedTransactionMetadata);
    expect(sim).to.be.instanceOf(FailedTransactionMetadata);
    expect(sim.meta().logs().some(log => log.includes("ValidationPeriodEnded"))).to.be.true;

    const candidateAccountData = await program.coder.accounts.decode<AaasAccounts["candidateAccount"]>(
      "candidateAccount", Buffer.from(svm.getAccount(candidateAccount)?.data!)
    );
    expect(candidateAccountData.acceptance).to.be.equal(0);
    console.log("Expectation✅ - proof validation failed as expected!");
  })

  /** 
   * deny withdraw reward before time, withdraw reward for winner, and denied reward for loser
   * we'll use new candidates as validator, while the candidate define in testValues will be the candidate
   */

  it("withdraw rewards too soon, and it shold failed!", async () => {
    //reset time to base or 0 to allow for join challenge
    setClock(svm, BigInt(0));

    //create candidates and join challenge
    for (let i = 0; i < 30; i++) {
      const newCandidate = await joinChallengeWithNewCandidate(svm, testValues, program);
      candidates.push(newCandidate);
    }
    console.log("candidates joined challenge✔️");

    //set clock within validation period to submit proof, and validate
    setClock(svm, BigInt(testValues.challenge.startTime.toNumber() + 500));
    //submit proof incase not submitted
    try {
      await submitProof(svm, program, testValues.challenge.key, testValues.candidate.payer, testValues.candidate.account);
    } catch (err) {
      console.log("already submitted proof");
    }
    const candidateAccountData1 = program.coder.accounts.decode<AaasAccounts["candidateAccount"]>(
      "candidateAccount", Buffer.from(svm.getAccount(testValues.candidate.account)?.data!)
    );
    expect(candidateAccountData1.proof).to.be.not.empty;
    expect(candidateAccountData1.candidate.equals(testValues.candidate.payer.publicKey)).to.be.true;
    expect(candidateAccountData1.rewarded).to.be.false;
    expect(candidateAccountData1.acceptance).to.be.lessThan(5);
    console.log("proof submit✔️");

    //withdraw too soon within validation period
    const tooSoonTx = await program.methods.withdrawReward().accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
      usdcMint: testValues.usdcMint.publicKey,
      winner: testValues.candidate.payer.publicKey,
      //@ts-ignore
      winnerAccount: testValues.candidate.account,
      config: testValues.config.key,
      service: testValues.service.key,
      challenge: testValues.challenge.key,
      treasury: testValues.treasury
    }).transaction();
    tooSoonTx.recentBlockhash = svm.latestBlockhash();
    tooSoonTx.sign(testValues.candidate.payer);
    const tooSoonSim = svm.simulateTransaction(tooSoonTx);
    const tooSoonRes = svm.sendTransaction(tooSoonTx);
    console.log(tooSoonSim.meta().logs());
    expect(tooSoonRes).to.be.instanceOf(FailedTransactionMetadata);
    expect(tooSoonSim.meta().logs().some(log => log.includes("ValidationPeriod"))).to.be.true;
    console.log("withdraw reward too soon, denied✔️");
  })

  it("withdraw reward with low votes, and it should failed!", async () => {
    //set time to after validation period
    const newTime = BigInt(testValues.challenge.endTime.toNumber() + (60 * 60 * 24) + 1000);
    setClock(svm, newTime);
    console.log("new time:", svm.getClock().unixTimestamp, " is it what I set?", newTime === svm.getClock().unixTimestamp);

    //withdraw with no enough acceptance, and it will failed
    const lowVoteTx = await program.methods.withdrawReward().accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
      usdcMint: testValues.usdcMint.publicKey,
      winner: testValues.candidate.payer.publicKey,
      //@ts-ignore
      winnerAccount: testValues.candidate.account,
      config: testValues.config.key,
      service: testValues.service.key,
      challenge: testValues.challenge.key,
      treasury: testValues.treasury,
    }).transaction();
    lowVoteTx.recentBlockhash = svm.latestBlockhash();
    lowVoteTx.sign(testValues.candidate.payer);
    const lowVoteSim = svm.simulateTransaction(lowVoteTx);
    const lowVoteRes = svm.sendTransaction(lowVoteTx);
    console.log(lowVoteSim.meta().logs());
    expect(lowVoteRes).to.be.instanceOf(FailedTransactionMetadata);
    expect(lowVoteSim.meta().logs().some(log => log.includes("WinningThreshold"))).to.be.true;
    console.log("withdraw reward with low acceptance, denied✔️");
  })

  it("should withdraw reward at right time with enough acceptanc!", async () => {
    //validate testValue candidate
    candidates.forEach(async ([candidate, candidateAccount]) => {
      const [sim, res] = await validateProof(svm, testValues, candidate, testValues.candidate.account, program);
      expect(res).to.be.instanceOf(TransactionMetadata);
    })
    const candidateAccountData2 = program.coder.accounts.decode<AaasAccounts["candidateAccount"]>(
      "candidateAccount", Buffer.from(svm.getAccount(testValues.candidate.account)?.data!)
    );
    expect(candidateAccountData2.acceptance).to.be.greaterThanOrEqual(30);
    console.log("test candidate has accpetance >= 30 ✔️");

    //withdraw during validation period, and it will failed
    const tx = await program.methods.withdrawReward().accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
      usdcMint: testValues.usdcMint.publicKey,
      winner: testValues.candidate.payer.publicKey,
      //@ts-ignore
      winnerAccount: testValues.candidate.account,
      config: testValues.config.key,
      service: testValues.service.key,
      challenge: testValues.challenge.key,
      treasury: testValues.treasury,
    }).transaction();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(testValues.candidate.payer);
    const txSim = svm.simulateTransaction(tx);
    const txRes = svm.sendTransaction(tx);
    console.log(txSim.meta().logs());
    expect(txRes).to.be.instanceOf(TransactionMetadata);
    expect(txSim.meta().logs().some(log => log.includes("failed"))).to.be.false;
    console.log("withdraw reward with high acceptance, succeed");

    //checks
    //const 
  })

})
