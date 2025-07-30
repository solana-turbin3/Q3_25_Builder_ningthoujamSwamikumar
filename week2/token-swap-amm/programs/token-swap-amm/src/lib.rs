pub mod amm_error;
pub mod constants;
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

    pub fn create_amm(ctx: Context<CreateAmm>, id: Pubkey, fee: u16) -> Result<()> {
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

    pub fn swap_token(
        ctx: Context<SwapToken>,
        swap_a: bool,
        input_amount: u64,
        min_output_amount: u64,
    ) -> Result<()> {
        swap_exact_token_for_token::handler(ctx, swap_a, input_amount, min_output_amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        withdraw_liquidity::handler(ctx, amount)
    }
}
