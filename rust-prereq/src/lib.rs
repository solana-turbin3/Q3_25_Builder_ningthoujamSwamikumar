#[cfg(test)]
mod tests {
    use bs58;
    use solana_client::rpc_client::RpcClient;
    use solana_program::{
        example_mocks::solana_sdk::system_program, pubkey::Pubkey, system_instruction::transfer,
    };
    use solana_sdk::{
        blake3::hash,
        instruction::{AccountMeta, Instruction},
        message::Message,
        signature::{Keypair, Signer, read_keypair_file},
        transaction::Transaction,
    };
    use std::str::FromStr;
    use std::{
        fs,
        io::{self, BufRead},
    };

    #[test]
    fn keygen() {
        let kp = Keypair::new();
        println!(
            "You've generated a new Solana wallet: {}",
            kp.pubkey().to_string()
        );
        println!();
        println!("To save your wallet, copy and paste the following into a JSON file:");
        println!("{:?}", kp.to_bytes());
    }

    #[test]
    fn base58_to_wallet() {
        println!("Input your private key as a base58 string:");
        let stdin = io::stdin();
        let base58 = stdin.lock().lines().next().unwrap().unwrap();
        println!("Your wallet file format is:");
        let wallet = bs58::decode(base58).into_vec().unwrap();
        println!("{:?}", wallet);
    }

    #[test]
    fn wallet_to_base58() {
        println!("Input your private key as a JSON byte array (e.g.[12, 34, ...]):");
        let stdin = io::stdin();
        let wallet = stdin
            .lock()
            .lines()
            .next()
            .unwrap()
            .unwrap()
            .trim_start_matches("[")
            .trim_end_matches("]")
            .split(",")
            .map(|s| s.trim().parse::<u8>().unwrap())
            .collect::<Vec<u8>>();
        println!("Your Base58-encoded private key is:");
        let base58 = bs58::encode(wallet).into_string();
        println!("{:?}", base58);
    }

    const _TURBINE3_RPC_URL: &str =
        "https://turbine-solanad-4cde.devnet.rpcpool.com/9a9da9cf-6db1-47dc-839a-55aca5c9c80a";
    const RPC_URL: &str = "https://api.devnet.solana.com";

    #[test]
    fn airdrop() {
        let keypair = read_keypair_file("dev-wallet.json").expect("Couldn't find wallet file");

        //establish connection to Solana devnet using the const we defined
        let client = RpcClient::new(RPC_URL);
        //claim 2 devnet SOL (2 billion lamports)
        match client.request_airdrop(&keypair.pubkey(), 2_000_000_000u64) {
            Ok(sig) => {
                println!("Success! Check your TX here:");
                println!("https://explorer.solana.com/tx/{sig}?cluster=devnet");
            }
            Err(err) => {
                println!("Airdrop failed: {}", err);
            }
        }
    }

    #[test]
    fn check_balance() {
        let keypair = read_keypair_file("dev-wallet.json").expect("couldn't find wallet file");

        let client = RpcClient::new(RPC_URL);
        match client.get_balance(&keypair.pubkey()) {
            Ok(balance) => {
                println!("Your dev account balance is: {balance}");
            }
            Err(err) => {
                println!("Error fetching dev wallet balance: {}", err);
            }
        }
    }

    #[test]
    fn transfer_sol() {
        //load devnet keypair from file
        let keypair = read_keypair_file("dev-wallet.json").expect("couldn't find wallet file");

        //generate a signature from the keypair
        let pubkey = keypair.pubkey();
        let message_bytes = b"I verify my Solana Keypair!";
        let sig = keypair.sign_message(message_bytes);
        let sig_hashed = hash(sig.as_ref());

        //verify the signature using the public key
        match sig.verify(&pubkey.to_bytes(), &sig_hashed.to_bytes()) {
            true => println!("Signature verified"),
            false => println!("Verification failed"),
        };

        //destination (Turbin3) address for transfer
        let to_pubkey = Pubkey::from_str("DWR8txcukE8MCG6XXojpmwLrYMTkDfNm7q86vZpQtsrs").unwrap();

        //connect to devnet
        let rpc_client = RpcClient::new(RPC_URL);

        //fetch recent blockhash
        let recent_blockhash = rpc_client
            .get_latest_blockhash()
            .expect("Failed to get recent blockhash");

        let transaction = Transaction::new_signed_with_payer(
            &[transfer(&keypair.pubkey(), &to_pubkey, 1_000_000)],
            Some(&keypair.pubkey()),
            &vec![keypair],
            recent_blockhash,
        );

        //send the transaction and print tx
        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");

        println!(
            "Success! Check out your TX here:\nhttps://explorer.solana.com/tx/{}?cluster=devnet",
            signature
        );
    }

    #[test]
    fn empty_dev_wallet() {
        //load devnet keypair from file
        let keypair = read_keypair_file("dev-wallet.json").expect("couldn't find wallet file");

        let pubkey = keypair.pubkey();

        //destination (Turbin3) address for transfer
        let to_pubkey = Pubkey::from_str("DWR8txcukE8MCG6XXojpmwLrYMTkDfNm7q86vZpQtsrs").unwrap();

        //connect to devnet
        let rpc_client = RpcClient::new(RPC_URL);

        //fetch recent blockhash
        let recent_blockhash = rpc_client
            .get_latest_blockhash()
            .expect("Failed to get recent blockhash");

        let balance = rpc_client
            .get_balance(&keypair.pubkey())
            .expect("Failed to get balance");
        //mock transaction to calculate fee
        let message = Message::new_with_blockhash(
            &[transfer(&keypair.pubkey(), &to_pubkey, balance)],
            Some(&keypair.pubkey()),
            &recent_blockhash,
        );
        //estimate transaction fee
        let fee = rpc_client
            .get_fee_for_message(&message)
            .expect("Failed to get fee calculator");

        let transaction = Transaction::new_signed_with_payer(
            &[transfer(&keypair.pubkey(), &to_pubkey, balance - fee)],
            Some(&keypair.pubkey()),
            &vec![keypair],
            recent_blockhash,
        );

        //send the transaction and print tx
        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");

        println!(
            "Success! Entire balance transferred here:\nhttps://explorer.solana.com/tx/{}?cluster=devnet",
            signature
        );
    }

    #[test]
    fn submit_rust_prereq() {
        let rpc_client = RpcClient::new(RPC_URL);

        //read turbin wallet
        let file_path = "Turbin3-wallet.json";
        let private_key_base58 =
            fs::read_to_string(file_path.to_string()).expect("Failed reading wallet");
        let keypair = Keypair::from_base58_string(private_key_base58.trim());

        // println!("Success reading turbin3 wallet");
        // println!("public key: {}", keypair.pubkey().to_string());
        // println!("private key: {}", keypair.to_base58_string());

        //constants
        let turbin3_prereq_program =
            Pubkey::from_str("TRBZyQHB3m68FGeVsqTK39Wm4xejadjVhP5MAZaKWDM").unwrap();
        let collection = Pubkey::from_str("5ebsp5RChCGK7ssRZMVMufgVZhd2kFbNaotcZ5UvytN2").unwrap();
        let mpl_core_program =
            Pubkey::from_str("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d").unwrap();
        let system_program = system_program::ID;

        //enrollment account (pda)
        let signer_pubkey = keypair.pubkey();
        let seeds = &[b"prereqs", signer_pubkey.as_ref()];
        let (enrollment_account, _bump) =
            Pubkey::find_program_address(seeds, &turbin3_prereq_program);

        //nft mint (new key)
        let mint_rs = Keypair::new();

        //authority
        let authority_seeds = &[
            &[99, 111, 108, 108, 101, 99, 116, 105, 111, 110],
            collection.as_ref(),
        ];
        let (authority, _bump) =
            Pubkey::find_program_address(authority_seeds, &turbin3_prereq_program);

        //anchor discriminator, it uniquely identifies the instruction your program expects. from IDL, the submit_rs instruction discriminator is:
        let discriminator = vec![77, 124, 82, 163, 21, 133, 181, 206];

        let accounts = vec![
            AccountMeta::new(signer_pubkey, true),       //user signer
            AccountMeta::new(enrollment_account, false), //PDA account
            AccountMeta::new(mint_rs.pubkey(), true),    //mint keypair
            AccountMeta::new(collection, false),         //collection
            AccountMeta::new_readonly(authority, false), //authority (pda)
            AccountMeta::new_readonly(mpl_core_program, false), //mpl core program
            AccountMeta::new_readonly(system_program, false),
        ];

        let blockhash = rpc_client
            .get_latest_blockhash()
            .expect("Failed to get recent blockhash");

        let instruction = Instruction {
            program_id: turbin3_prereq_program,
            accounts,
            data: discriminator,
        };

        let transaction = Transaction::new_signed_with_payer(
            &[instruction],
            Some(&signer_pubkey),
            &[keypair, mint_rs],
            blockhash,
        );

        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");

        println!(
            "Success! Check out your TX here:
        https://explorer.solana.com/tx/{}?cluster=devnet",
            signature
        );
    }
}
