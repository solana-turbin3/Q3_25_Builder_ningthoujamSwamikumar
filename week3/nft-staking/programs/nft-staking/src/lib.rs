pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("AfXaZVFhriFMKPqB8rLe6bnXLMkpmRwyG1moDCwvawpa");

#[program]
pub mod nft_staking {
    use super::*;

    //we are initializing global accounts which config, and user account, separately
    //to avoid corruption from inidividual instruction corruptions
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        points_per_stake: u8,
        max_unstake: u8,
        freeze_period: u32,
    ) -> Result<()> {
        ctx.accounts
            .handler(points_per_stake, max_unstake, freeze_period, ctx.bumps)
    }

    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        ctx.accounts.handler(ctx.bumps)
    }

    pub fn stake_nft(ctx: Context<Stake>) -> Result<()> {
        ctx.accounts.handler(ctx.bumps)
    }

    pub fn unstake_nft(ctx: Context<Unstake>) -> Result<()> {
        ctx.accounts.handler()
    }

    pub fn unstake_multiple(ctx: Context<UnstakeMultiple>) -> Result<()> {
        unstake_multiple::handler(ctx)
    }
}
