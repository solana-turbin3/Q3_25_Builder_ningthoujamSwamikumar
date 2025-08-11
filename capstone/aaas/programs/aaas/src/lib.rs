pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("3K3jk5TxBYpK4Fb9ogLoZu91cGxxS7PEPwe3AxdegUgJ");

#[program]
pub mod aaas {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, signers: Vec<Pubkey>, threshold: u8) -> Result<()> {
        ctx.accounts.handler(signers, threshold, ctx.bumps)
    }

    pub fn initialize_service(
        ctx: Context<InitService>,
        id: Pubkey,
        fee: u16,
        winning_threshold: u16,
    ) -> Result<()> {
        ctx.accounts.handler(id, fee, winning_threshold, ctx.bumps)
    }

    pub fn create_challenge(
        ctx: Context<CreateChallenge>,
        id: Pubkey,
        start_time: u64,
        end_time: u64,
        stake_amnt: u16,
        proof: String,
    ) -> Result<()> {
        ctx.accounts.handler(
            id,
            start_time,
            end_time,
            stake_amnt,
            proof,
            ctx.accounts.service.key(),
            ctx.bumps,
        )
    }

    pub fn join_challenge(ctx: Context<JoinChallenge>, id: Pubkey) -> Result<()> {
        ctx.accounts.handler(ctx.bumps.candidate_account)
    }
}
