use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::extension::AccountType;
use anchor_spl::token_interface;

use crate::constants::{USER_SEED, REWARD_MINT_SEED, CONFIG_SEED};
use crate::{Config, UserAccount};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [USER_SEED, user.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [REWARD_MINT_SEED, config.key().as_ref()],
        bump = config.bump
    )]
    pub reward_mint: InterfaceAccount<'info, token_interface::Mint>,
}
