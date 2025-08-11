use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AaasConfig {
    #[max_len(5)]
    pub signers: Vec<Pubkey>,
    pub threshold: u8,
    pub bump: u8,
    pub treasury_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Service {
    ///service identifier
    pub id: Pubkey,
    ///winning acceptance threshold in basis point
    pub winning_threshold: u16,
    ///service fee in basis point
    pub fee: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Challenge {
    ///challenge id
    pub id: Pubkey,
    pub start_time: u64,
    pub end_time: u64,
    pub stake_amnt: u16,
    #[max_len(200)]
    pub proof: String,
    pub service_key: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CandidateAccount {
    /// challenge key
    pub challenge_key: Pubkey,
    /// proof link
    #[max_len(100)]
    pub proof: String,
    pub candidate_key: Pubkey,
    pub acceptance: u16,
    pub bump: u8,
}
