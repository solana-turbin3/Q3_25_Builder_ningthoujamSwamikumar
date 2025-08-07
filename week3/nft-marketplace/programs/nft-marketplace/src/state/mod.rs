use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Marketplace {
    pub admin: Pubkey,
    pub fee: u16, //in basis point or [0, 10000] where 10000 = 100.00%
    pub bump: u8,
    pub treasury_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ListingAccount {
    pub owner: Pubkey,
    pub mint: Pubkey,  //mint of nft listed
    pub price: u16, //price of the asset listed
    pub bump: u8,
}
