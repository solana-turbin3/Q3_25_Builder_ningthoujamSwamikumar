import { BN, Program, web3 } from "@coral-xyz/anchor"
import { DiceGame } from "../target/types/dice_game";

export interface ITestValues {
    houseDeposits: BN,
    vault: web3.PublicKey,
    player: web3.Keypair,
    betAmnt: BN,
    roll: number,
    seed: BN,
    betAcc: web3.PublicKey,
}

export const VAULT_SEED = Buffer.from("diceVault");
export const BET_SEED = Buffer.from("diceBet");

export const createValues = async (program: Program<DiceGame>): Promise<ITestValues> => {
    const { wallet, connection } = program.provider;

    //create vault system account
    const [vault, vB] = web3.PublicKey.findProgramAddressSync([VAULT_SEED, wallet.publicKey.toBuffer()], program.programId);
    const lamportsSysAcc = await connection.getMinimumBalanceForRentExemption(0);
    web3.SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        lamports: lamportsSysAcc,
        newAccountPubkey: vault,
        programId: web3.SystemProgram.programId,
        space: 0,
    });

    const player = new web3.Keypair();
    connection.requestAirdrop(player.publicKey, 100 * web3.LAMPORTS_PER_SOL);

    const houseDeposits = new BN(10000 * web3.LAMPORTS_PER_SOL);
    const betAmnt = new BN(5 * web3.LAMPORTS_PER_SOL);
    const roll = Math.floor(Math.random() * 101);
    const seed = new BN(Math.random() * web3.LAMPORTS_PER_SOL);

    const [betAccnt, betB] = web3.PublicKey.findProgramAddressSync([BET_SEED, wallet.publicKey.toBuffer(), player.publicKey.toBuffer()], program.programId);

    return {
        vault,
        player,
        houseDeposits,
        betAmnt,
        roll,
        seed,
        betAcc: betAccnt,
    }
}

