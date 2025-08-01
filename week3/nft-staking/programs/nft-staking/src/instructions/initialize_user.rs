use anchor_lang::prelude::*;

use anchor_lang::Accounts;

use crate::{
    constants::{CONFIG_SEED, USER_SEED},
    Config, UserAccount,
};

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = user,
        seeds = [USER_SEED, user.key().as_ref()],
        bump,
        space = 8 + UserAccount::INIT_SPACE,
    )]
    pub user_account: Account<'info, UserAccount>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeUser<'info> {
    pub fn handler(&mut self, bumps: InitializeUserBumps) -> Result<()> {
        self.user_account.set_inner(UserAccount {
            points: 0u32,
            amount_staked: 0u8,
            bump: bumps.user_account,
        });
        Ok(())
    }
}
