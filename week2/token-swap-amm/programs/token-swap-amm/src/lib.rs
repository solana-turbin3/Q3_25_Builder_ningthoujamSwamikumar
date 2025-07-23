pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("GKQ1FR3p298PsaqkBV7ZNzBMZWA4FNzjAdK2dggtJPVj");

#[program]
pub mod token_swap_amm {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }

    pub fn create_amm(ctx: Context<CreateAmm>, id: u64, fee: u64) -> Result<()> {
        create_amm::handler(ctx, id, fee)
    }

    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        create_pool::handler(ctx)
    }

    pub fn deposit_liquidity(
        ctx: Context<DepositLiquidity>,
        amount_a: u64,
        amount_b: u64,
    ) -> Result<()> {
        deposit_liquidity::handler(ctx, amount_a, amount_b)
    }
}
