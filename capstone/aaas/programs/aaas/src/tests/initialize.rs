use anchor_lang::prelude::Pubkey;
use litesvm::LiteSVM;

#[test]
fn initialize(){
    println!("Is Initialized!");

    let mut svm = LiteSVM::new();

    let program_id = Pubkey::new_unique();
    // let path = "../../../target/deploy/aaas.so";
    // svm.add_program_from_file(program_id, path)?;
    //let program_bytes = 
}
