pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("GzCXPp5fPcF3MxGwmHpbkbnK7LFfjDmiMTvA84YacNcM");

#[program]
pub mod dice_game {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, amnt: u64) -> Result<()> {
        initialize::handler(ctx, amnt)
    }

    pub fn place_bet(ctx: Context<PlaceBet>, amnt: u64, roll: u8, seed: u128) -> Result<()> {
        ctx.accounts.place_bet(seed, roll, amnt, ctx.bumps)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        ctx.accounts.refund(ctx.bumps.vault)
    }

    pub fn resolve_bet(ctx: Context<ResolveBet>, sig: [u8; 64]) -> Result<()> {
        ctx.accounts.verify_ed25519_signature(&sig)?;
        ctx.accounts.resolve_bet(&sig, ctx.bumps)
    }
}
