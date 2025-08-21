use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Bet {
    pub player: Pubkey,
    pub bump: u8,
    pub roll: u8,
    pub amnt: u64,
    pub seed: u128, //seed and slot are players contribution to randomness (not only house can control the randomness) as this bet fields are going to be hash,
    pub slot: u64, //and used as a message for a instruction and then used the signature as a source of randomness
}

impl Bet {
    pub fn to_slice(&self) -> Vec<u8> {
        let mut s = self.amnt.to_le_bytes().to_vec(); //solana uses le bytes
        s.extend_from_slice(&self.bump.to_le_bytes());
        s.extend_from_slice(&self.player.key().to_bytes());
        s.extend_from_slice(&self.roll.to_le_bytes());
        s.extend_from_slice(&self.seed.to_le_bytes());
        s.extend_from_slice(&self.slot.to_le_bytes());

        s
    }
}
