use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Amm {
    pub id: Pubkey,    
    pub admin: Pubkey,
    pub fee: u16,   //basis point
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub amm: Pubkey,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
}

#[account]
pub struct PoolAuthority {}
