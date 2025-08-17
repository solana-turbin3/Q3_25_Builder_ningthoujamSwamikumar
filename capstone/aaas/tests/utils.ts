import { BN, Program } from "@coral-xyz/anchor";
import { createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMintToInstruction, getAssociatedTokenAddressSync, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { FailedTransactionMetadata, LiteSVM, SimulatedTransactionInfo, TransactionMetadata } from "litesvm";
import { Aaas } from "../target/types/aaas";
import { expect } from "chai";

export type ITestValues = {
    admin: Keypair;
    usdcMint: Keypair;
    config: {
        key: PublicKey;
        threshold: number;
        signers: Keypair[];
    };
    service: {
        id: PublicKey;
        key: PublicKey;
        fee: number;
    };
    challenge: {
        id: PublicKey;
        startTime: BN;
        endTime: BN;
        stakeAmnt: number;
        winningThreshold: number; //basis point
        proof: string;
        key: PublicKey;
        bump: number;
        vault: PublicKey;
        creator: Keypair;
    },
    candidate: {
        payer: Keypair;
        account: PublicKey;
        ata: PublicKey;
    },
    treasury: PublicKey,
}

/**
 * 
 * @param svm 
 * @param program 
 * @returns create values that are required in testings
 */
export const createValues = async (svm: LiteSVM, program: Program<Aaas>): Promise<ITestValues> => {
    const admin = new Keypair();
    svm.airdrop(admin.publicKey, BigInt(100_000_000));
    const usdcMint = new Keypair();

    let multiSigners: Keypair[] = [];
    multiSigners.push(admin);
    multiSigners.push(new Keypair());
    multiSigners.push(new Keypair());
    multiSigners.push(new Keypair());
    multiSigners.push(new Keypair());

    //create usdc mint account
    const lamports = svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE));
    const createUsdcMintTx = new Transaction().add(
        SystemProgram.createAccount(
            {
                fromPubkey: admin!.publicKey,
                lamports: Number(lamports),
                newAccountPubkey: usdcMint.publicKey,
                programId: TOKEN_PROGRAM_ID,
                space: MINT_SIZE
            }
        )
    ).add(
        createInitializeMintInstruction(usdcMint.publicKey, 6, admin.publicKey, null, TOKEN_PROGRAM_ID)
    );
    createUsdcMintTx.recentBlockhash = svm.latestBlockhash();
    createUsdcMintTx.sign(admin, usdcMint);
    const res = svm.sendTransaction(createUsdcMintTx);
    console.log("create usdc mint account ✔️:", res);

    const serviceId = PublicKey.unique();
    const configPda = PublicKey.findProgramAddressSync([Buffer.from("aaasConfig")], program.programId);
    const servicePda = PublicKey.findProgramAddressSync([Buffer.from("aaasService"), serviceId.toBuffer()], program.programId);

    const creator = new Keypair();
    if (svm.airdrop(creator.publicKey, BigInt(100 * LAMPORTS_PER_SOL)) instanceof FailedTransactionMetadata)
        throw new Error("Aidrop creator failed!");
    const challengeId = PublicKey.unique();
    const challengePda = PublicKey.findProgramAddressSync([
        Buffer.from("aaasChallenge"), servicePda[0].toBuffer(), challengeId.toBuffer()
    ], program.programId);
    const vault = getAssociatedTokenAddressSync(usdcMint.publicKey, challengePda[0], true);

    const [candidate, candidateAccount] = generateCandidate(svm, servicePda[0], challengePda[0], program.programId);
    const candidateAta = await initCandidateAta(usdcMint, candidate, svm, admin);

    const treasury = getAssociatedTokenAddressSync(usdcMint.publicKey, admin.publicKey, false);

    return {
        admin,
        usdcMint,
        config: {
            key: configPda[0],
            signers: multiSigners,
            threshold: 2,
        },
        service: {
            fee: 30, //in basis point
            id: serviceId,
            key: servicePda[0],
        },
        challenge: {
            id: challengeId,
            key: challengePda[0],
            bump: challengePda[1],
            endTime: new BN(svm.getClock().unixTimestamp).add(new BN(60 * 60 * 24 * 7)),
            startTime: new BN(svm.getClock().unixTimestamp).add(new BN(60 * 60 * 24)),
            proof: "",
            stakeAmnt: 500,
            winningThreshold: 8500,
            creator,
            vault
        },
        candidate: {
            payer: candidate,
            account: candidateAccount,
            ata: candidateAta,
        },
        treasury
    }
}

/**
 * generate new candidate if candidate is not provided, and candidateAccount
 * @param svm 
 * @param service 
 * @param challenge 
 * @param programId 
 * @returns an array of candidate keypair, and candidateAccount
 */
export const generateCandidate = (
    svm: LiteSVM,
    service: PublicKey,
    challenge: PublicKey,
    programId: PublicKey,
    defaultCandidate?: Keypair,
): [Keypair, PublicKey] => {
    const candidate = defaultCandidate ?? new Keypair();
    //console.log("candidate in generateCandidate: ", candidate);
    if (!defaultCandidate && svm.airdrop(candidate.publicKey, BigInt(10 * LAMPORTS_PER_SOL)) instanceof FailedTransactionMetadata)
        throw new Error("Airdrop candidate failed!");
    const candidateAccountPda = PublicKey.findProgramAddressSync([
        Buffer.from("aaasCandidate"), service.toBuffer(), challenge.toBuffer(), candidate.publicKey.toBuffer()
    ], programId);

    return [candidate, candidateAccountPda[0]];
}

/**
 * derive ata and mint some usdc
 * @param usdcMint 
 * @param candidate 
 * @param svm 
 * @param payer usdc mint authority
 * @return candidate ata
 */
export const initCandidateAta = async (usdcMint: Keypair, candidate: Keypair, svm: LiteSVM, payer: Keypair): Promise<PublicKey> => {
    const candidateAta = getAssociatedTokenAddressSync(usdcMint.publicKey, candidate.publicKey);
    const candidateAtaTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(candidate.publicKey, candidateAta, candidate.publicKey, usdcMint.publicKey)
    );
    candidateAtaTx.recentBlockhash = svm.latestBlockhash();
    candidateAtaTx.sign(candidate);
    const candidateAtaRes = svm.sendTransaction(candidateAtaTx);
    console.log("candidateAtaRes:", candidateAtaRes);

    //mint usdc token into candidate ata
    const usdcMintToTx = new Transaction().add(
        createMintToInstruction(usdcMint.publicKey, candidateAta, payer.publicKey, 900000000)
    );
    usdcMintToTx.recentBlockhash = svm.latestBlockhash();
    usdcMintToTx.sign(payer);
    const usdcMintToRes = svm.sendTransaction(usdcMintToTx);
    console.log("usdcMintToRes:", usdcMintToRes);

    return candidateAta;
}

/**
 * creates a keypair, airdrop it, and join challenge
 * @param svm 
 * @param testValues 
 * @param program 
 * @returns keypair, and associated candidate account
 */
export const joinChallengeWithNewCandidate = async (
    svm: LiteSVM,
    testValues: ITestValues,
    program: Program<Aaas>
): Promise<[Keypair, PublicKey]> => {
    const [candidate, candidateAccount] = generateCandidate(
        svm, testValues.service.key, testValues.challenge.key, program.programId);
    await initCandidateAta(testValues.usdcMint, candidate, svm, testValues.admin);

    //join the challenge and then later exit after the challenge started
    const joinTx = await program.methods.joinChallenge()
        .accounts({
            tokenProgram: TOKEN_PROGRAM_ID,
            usdcMint: testValues.usdcMint.publicKey,
            candidate: candidate.publicKey,
            //@ts-ignore
            challenge: testValues.challenge.key, //just passing challenge is not enough to derive both challenge, and candidateAccount PDAs
            candidateAccount, //this is needed as 
        }).transaction();
    joinTx.recentBlockhash = svm.latestBlockhash();
    joinTx.sign(candidate);
    const joinTxSim = svm.simulateTransaction(joinTx);
    //console.log(joinTxSim.meta().logs());
    const joinTxRes = svm.sendTransaction(joinTx);
    //console.log("joinTxRes:", joinTxRes);
    expect(joinTxRes).to.be.instanceOf(TransactionMetadata);
    console.log("Joined Challenge✔️");

    return [candidate, candidateAccount];
}

/**
 * submits a dummy proof link for a given candidate
 * @param svm 
 * @param program 
 * @param challenge 
 * @param candidate 
 * @param candidateAccount 
 */
export const submitProof = async (
    svm: LiteSVM,
    program: Program<Aaas>,
    challenge: PublicKey,
    candidate: Keypair,
    candidateAccount: PublicKey
) => {
    const proof = "http://linkt/to/proof";
    const tx = await program.methods.submitProof(proof)
        .accounts({
            challenge,
            candidate: candidate.publicKey,
            candidateAccount,
        }).transaction();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(candidate);
    const sim = svm.simulateTransaction(tx);
    //console.log(sim.meta().logs());
    const res = svm.sendTransaction(tx);
    expect(res).to.be.instanceOf(TransactionMetadata);
    console.log("Proof Submitted✔️");
}

/**
 * sets validator clock to a given unix timestamp
 * @param svm 
 * @param newTime 
 */
export const setClock = (svm: LiteSVM, newTime: bigint) => {
    let clock = svm.getClock();
    clock.unixTimestamp = newTime;
    svm.setClock(clock);
}

/**
 * Validates proof for a given candidate account, by a given validator
 * @param svm 
 * @param testValues 
 * @param validatorKp 
 * @param candidateAccount 
 * @param program 
 * @returns returns simulation result and send transaction result in an array
 */
export const validateProof = async (
    svm: LiteSVM,
    testValues: ITestValues,
    validatorKp: Keypair,
    candidateAccount: PublicKey,
    program: Program<Aaas>
): Promise<[
    FailedTransactionMetadata | SimulatedTransactionInfo,
    FailedTransactionMetadata | TransactionMetadata
]> => {
    const [validator, validatorAccount] = generateCandidate(svm, testValues.service.key, testValues.challenge.key, program.programId, validatorKp);
    const validation = PublicKey.findProgramAddressSync([Buffer.from("aaasValidation"), testValues.service.key.toBuffer(), testValues.challenge.key.toBuffer(), candidateAccount.toBuffer(), validator.publicKey.toBuffer()], program.programId)[0];

    const tx = await program.methods.validateProof()
        .accounts({
            validator: validator.publicKey,
            //@ts-ignore
            challenge: testValues.challenge.key,
            validatorAccount,
            candidateAccount,
            validation,
        }).transaction();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(validator);

    const sim = svm.simulateTransaction(tx);
    const res = svm.sendTransaction(tx);

    return [sim, res];
}
