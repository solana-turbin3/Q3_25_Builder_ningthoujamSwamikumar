import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import wallet from "./Turbin3-wallet.json";
import bs58 from "bs58";
import { IDL } from "./programs/Turbin3_prereq";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

const MPL_CORE_PROGRAM = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

const keypair = Keypair.fromSecretKey(bs58.decode(wallet));

const connection = new Connection(clusterApiUrl("devnet"));

// connection.getBalance(keypair.publicKey)
//     .then(val => {
//         console.log("payer balance:", val/LAMPORTS_PER_SOL);
//     })
//     .catch(e => { console.error("error fetching balance:", e) });

const provider = new AnchorProvider(connection, new Wallet(keypair), { commitment: "confirmed" });

const program = new Program(IDL, provider);

const [enrollment_account, _] = PublicKey.findProgramAddressSync([Buffer.from("prereqs"), keypair.publicKey.toBuffer()], program.programId);

// console.log("enrollment_account: ", enrollment_account.toBase58());

/* //completed initialization
(async () => {
    try {
        const txhash = await program.methods
            .initialize("ningthoujamSwamikumar")
            .accountsPartial({
                user: keypair.publicKey,
                account: enrollment_account,
                system_program: SystemProgram.programId,
            })
            .signers([keypair])
            .rpc();
        console.log(`Success! Check out your TX here:\nhttps://explorer.solana.com/tx/${txhash}?cluster=devnet`);
    } catch (e) {
        console.error(`Oops, something went wrong: ${e}`);
    }
})();
*/

const mintTs = Keypair.generate();
const mintCollection = new PublicKey("5ebsp5RChCGK7ssRZMVMufgVZhd2kFbNaotcZ5UvytN2");

(async () => {
    try {
        const txhash = await program.methods
            .submitTs()
            .accountsPartial({
                user: keypair.publicKey,
                account: enrollment_account,
                mint: mintTs.publicKey,
                collection: mintCollection,
                mpl_core_program: MPL_CORE_PROGRAM,
                system_program: SystemProgram.programId,
            })
            .signers([keypair, mintTs])
            .rpc();

        console.log(`Success! Check out your TX here:\nhttps://explorer.solana.com/tx/${txhash}?cluster=devnet`);
    } catch (e) {
        console.error(`Oops, something went wrong: ${e}`);
    }
})();
