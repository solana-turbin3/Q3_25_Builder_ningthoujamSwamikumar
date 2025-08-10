pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("Eqa9e49Wn3pqDfkJQGEr3XcEWZesZvgGJACVRTZhDGRi");

#[program]
pub mod nft_marketplace {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, fee: u16) -> Result<()> {
        ctx.accounts.handler(fee, ctx.bumps)
    }

    pub fn listing(ctx: Context<Listing>, price: u16) -> Result<()> {
        ctx.accounts.handler(ctx.bumps, price)
    }

    pub fn delisting(ctx: Context<Delisting>) -> Result<()> {
        ctx.accounts.handler()
    }

    pub fn purchase(ctx: Context<Purchase>) -> Result<()> {
        ctx.accounts.handler()
    }
}
