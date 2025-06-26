import {
    Connection,
    Keypair,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction,
    PublicKey
} from "@solana/web3.js";
import wallet from "./dev-wallet.json";

//import our dev wallet keypair from the wallet file
const from = Keypair.fromSecretKey(new Uint8Array(wallet));
//define out turbine3 public key
const to = new PublicKey("DWR8txcukE8MCG6XXojpmwLrYMTkDfNm7q86vZpQtsrs");

//create a devnet connectin
const connection = new Connection("https://api.devnet.solana.com");

(async () => {
    try {
        //get balance of the dev wallet
        const balance = await connection.getBalance(from.publicKey);

        //test transaction to calculate fees
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: from.publicKey,
                toPubkey: to,
                lamports: balance,
            })
        );
        transaction.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
        transaction.feePayer = from.publicKey;

        //calculate exact fee rate to transfer entire SOL amount out of account minus fees
        const fee = (await connection.getFeeForMessage(transaction.compileMessage(), "confirmed")).value;

        //remove our test transfer instruction to replace it with real transfer instruction
        transaction.instructions.pop();
        //now add the instruction back with correct amount of lamports
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: from.publicKey,
                toPubkey: to,
                lamports: balance - (fee ?? 0),
            }),
        );

        //sign transaction, broadcast, and confirm
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [from]
        );

        console.log(`Success! Check out your TX here:\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`);
    } catch (e) {
        console.error(`Oops, something went wrong: ${e}`);
    }
})();
