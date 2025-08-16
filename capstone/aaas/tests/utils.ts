import { BN, Program } from "@coral-xyz/anchor";
import { ACCOUNT_SIZE, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMintToInstruction, getAssociatedTokenAddressSync, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { FailedTransactionMetadata, LiteSVM } from "litesvm";
import { Aaas } from "../target/types/aaas";

export type ITestValues = {
    payer: Keypair;
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
    }
}

export const createValues = async (svm: LiteSVM, program: Program<Aaas>): Promise<ITestValues> => {
    const payer = new Keypair();
    svm.airdrop(payer.publicKey, BigInt(100_000_000));
    const usdcMint = new Keypair();

    let multiSigners: Keypair[] = [];
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
                fromPubkey: payer!.publicKey,
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

    const candidate = new Keypair();
    if (svm.airdrop(candidate.publicKey, BigInt(100 * LAMPORTS_PER_SOL)) instanceof FailedTransactionMetadata)
        throw new Error("Airdrop candidate failed!");
    const candidateAccountPda = PublicKey.findProgramAddressSync([
        Buffer.from("aaasCandidate"), servicePda[0].toBuffer(), challengePda[0].toBuffer(), candidate.publicKey.toBuffer()
    ], program.programId);
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

    return {
        payer,
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
            account: candidateAccountPda[0],
            ata: candidateAta,
        }
    }
}
