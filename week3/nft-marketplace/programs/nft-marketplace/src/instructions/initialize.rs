use anchor_lang::prelude::*;
use anchor_spl::token::Token;

use crate::constants::{MARKET_SEED, TREASURY_SEED};
use crate::state::Marketplace;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        seeds = [MARKET_SEED],
        bump,
        space = 8 + Marketplace::INIT_SPACE
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        seeds = [TREASURY_SEED, marketplace.key().as_ref()],
        bump
    )]
    pub treasury: SystemAccount<'info>, //this is a already created PDA account to keep collected fees

    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn handler(&mut self, fee: u16, bumps: InitializeBumps) -> Result<()> {
        self.marketplace.set_inner(Marketplace {
            admin: self.admin.key(),
            fee,
            bump: bumps.marketplace,
            treasury_bump: bumps.treasury,
        });
        Ok(())
    }
}
