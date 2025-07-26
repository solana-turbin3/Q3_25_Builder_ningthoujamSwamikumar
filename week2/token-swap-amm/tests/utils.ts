import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenSwapAmm } from "../target/types/token_swap_amm";
import { createMint, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

const { PublicKey, Keypair } = anchor.web3;

type PublicKey = anchor.web3.PublicKey;
type Keypair = anchor.web3.Keypair;
type Connection = anchor.web3.Connection;

export interface ITestValues {
    id: PublicKey;
    admin: Keypair;
    fee: number;
    ammKey: PublicKey;
    mintA: Keypair;
    mintB: Keypair;
    mintLiquidity: PublicKey;
    pool: PublicKey;
    poolAuthority: PublicKey;
    poolAccountA: PublicKey;
    poolAccountB: PublicKey;
    tokenProgram: PublicKey;
}

type TDefaultTestValues = Partial<ITestValues>;

export const createValues = (defaults?: TDefaultTestValues): ITestValues => {
    const program = anchor.workspace.tokenSwapAmm as Program<TokenSwapAmm>;

    const id = defaults?.id ?? PublicKey.unique();
    const fee = defaults?.fee ?? 30;
    const admin = defaults?.admin ?? Keypair.generate();
    const ammKey = PublicKey.findProgramAddressSync([id.toBuffer()], program.programId)[0];
    let mintA = defaults?.mintA ?? Keypair.generate();
    let mintB = defaults?.mintB ?? Keypair.generate();
    //make the smaller address to be mintA
    if (!defaults?.mintA && !defaults?.mintB && new anchor.BN(mintB.publicKey.toBytes()).lt(new anchor.BN(mintB.publicKey.toBytes()))) {
        [mintA, mintB] = [mintB, mintA];
    }
    let [mintLiquidity] = PublicKey.findProgramAddressSync(
        [ammKey.toBuffer(), mintA.publicKey.toBuffer(), mintB.publicKey.toBuffer(), Buffer.from("liquidity")],
        program.programId
    );
    let [pool] = PublicKey.findProgramAddressSync(
        [ammKey.toBuffer(), mintA.publicKey.toBuffer(), mintB.publicKey.toBuffer()],
        program.programId
    );
    const [poolAuthority] = PublicKey.findProgramAddressSync(
        [ammKey.toBuffer(), mintA.publicKey.toBuffer(), mintB.publicKey.toBuffer(), Buffer.from("authority")],
        program.programId
    );
    const tokenProgram = defaults?.tokenProgram ?? TOKEN_2022_PROGRAM_ID;
    const poolAccountA = getAssociatedTokenAddressSync(mintA.publicKey, poolAuthority, true, tokenProgram);
    const poolAccountB = getAssociatedTokenAddressSync(mintB.publicKey, poolAuthority, true, tokenProgram);

    return {
        id,
        fee,
        admin,
        ammKey,
        mintA,
        mintB,
        mintLiquidity,
        pool,
        poolAuthority,
        poolAccountA,
        poolAccountB,
        tokenProgram
    }
}

/**
 * mintA < mintB
 */
export const createAndMintTokens = async (
    mintAuthority: PublicKey,
    mintA: Keypair,
    mintB: Keypair,
    toMintTo: PublicKey,
    tokenProgram: PublicKey,
    connection: Connection,
    payer: anchor.web3.Signer
) => {
    await createMint(connection, payer, mintAuthority, mintAuthority, 4, mintA, { commitment: "confirmed" }, tokenProgram);
    await createMint(connection, payer, mintAuthority, mintAuthority, 3, mintB, { commitment: "confirmed" }, tokenProgram);
    //console.log("mints created");

    const ataA = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mintA.publicKey,
        toMintTo,
        false,
        "confirmed",
        { commitment: "confirmed" },
        tokenProgram
    );
    const ataB = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mintB.publicKey,
        toMintTo,
        false,
        "confirmed",
        { commitment: "confirmed" },
        tokenProgram
    );
    //console.log("atas created");

    await mintTo(
        connection,
        payer,
        mintA.publicKey,
        ataA.address,
        mintAuthority,
        1000 * Math.pow(10, 4),
        undefined,
        { commitment: "confirmed" },
        tokenProgram
    );
    await mintTo(
        connection,
        payer,
        mintB.publicKey,
        ataB.address,
        mintAuthority,
        1000 * Math.pow(10, 3),
        undefined,
        { commitment: "confirmed" },
        tokenProgram
    );
    //console.log("tokens minted to atas");
}

