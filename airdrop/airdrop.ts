import {Connection, Keypair, LAMPORTS_PER_SOL} from "@solana/web3.js";

import wallet from "./dev-wallet.json";

//create keypair from our wallet private key
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//create a solana devnet connection
const connection = new Connection("https://api.devnet.solana.com");

(async ()=>{
    try {
        //we're going to claim 2 devnet SOL tokens
        const txhash = await connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL);
        
        console.log(`Success! Check out your TX here:\nhttps://explorer.solana.com/tx/${txhash}?cluster=devnet`);
    }catch(e){
        console.error(`Oops, something went wrong: ${e}`);
    }
})();

