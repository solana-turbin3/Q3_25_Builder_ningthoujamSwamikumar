use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Amm {
    pub id: u64,
    pub admin: Pubkey,
    pub fee: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub amm: Pubkey,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
}
