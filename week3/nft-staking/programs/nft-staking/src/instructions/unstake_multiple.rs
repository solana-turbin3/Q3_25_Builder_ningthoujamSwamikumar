use anchor_lang::{context, prelude::*};
use anchor_spl::token_interface;

use crate::constants::{CONFIG_SEED, STAKE_SEED, USER_SEED};
use crate::{Config, StakeAccount, UserAccount};

#[derive(Accounts)]
pub struct UnstakeMultiple<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [USER_SEED, user.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    pub mint: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority=user,
        associated_token::token_program = token_program
    )]
    pub user_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority=stake_account,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        mut,
        seeds = [STAKE_SEED, stake_account.owner.key().as_ref(), stake_account.mint.key().as_ref()],
        bump = stake_account.bump,
        has_one = mint,
        constraint = stake_account.owner == user.key(),
        close = user,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    pub token_program: Interface<'info, token_interface::TokenInterface>,
}

//impl<'info> UnstakeMultiple<'info> {}

pub fn handler<'info>(
    ctx: Context<UnstakeMultiple<'info>>, // remaining_accounts: &[AccountInfo<'info>],
) -> Result<()> {
    //check if this operation is valid for the user i.e. see if he has any nft staked at all
    //deserialize and validate remaining accounts
    //check the nfts for freeze periods
    //calculate reward
    //transfer unstaking nft
    //close vault account
    //update reward points for the user
    Ok(())
}
