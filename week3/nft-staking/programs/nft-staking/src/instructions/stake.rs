use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface;

use crate::constants::{STAKE_SEED, USER_SEED};
use crate::{StakeAccount, UserAccount};

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub mint: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        init,
        payer = user,
        seeds = [STAKE_SEED, user.key().as_ref(), mint.key().as_ref()],
        bump,
        space = 8 + StakeAccount::INIT_SPACE,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(
        mut,
        seeds = [USER_SEED, user.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = stake_account,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, token_interface::TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Stake<'info> {
    pub fn handler(&mut self, bumps: StakeBumps) -> Result<()> {
        let clock = Clock::get()?;

        self.stake_account.set_inner(StakeAccount {
            owner: self.user.key(),
            mint: self.mint.key(),
            staked_at: clock.unix_timestamp,
            bump: bumps.stake_account,
        });

        self.user_account.amount_staked = self.user_account.amount_staked.saturating_add(1);

        token_interface::transfer_checked(
            CpiContext::new(
                self.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: self.user_ata.to_account_info(),
                    mint: self.mint.to_account_info(),
                    to: self.vault.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            ),
            1,
            0,
        )
    }
}
