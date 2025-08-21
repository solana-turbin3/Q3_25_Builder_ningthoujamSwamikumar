use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::constants::VAULT_SEED;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub house: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, house.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, amnt: u64) -> Result<()> {
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.house.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amnt,
    )
}
