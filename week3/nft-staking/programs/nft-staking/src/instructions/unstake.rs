use anchor_lang::prelude::*;
use anchor_spl::token_interface;

use crate::constants::{CONFIG_SEED, STAKE_SEED, USER_SEED, YEAR_IN_SECS};
use crate::error::StakingError;
use crate::{Config, StakeAccount, UserAccount};

#[derive(Accounts)]
pub struct Unstake<'info> {
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

impl<'info> Unstake<'info> {
    pub fn handler(&mut self) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        //check if this operation is valid for the user i.e. see if he has any nft staked at all
        require!(
            self.user_account.amount_staked > 0,
            StakingError::NoStakeFound
        );
        //check the nft for freeze period
        require!(
            self.stake_account.staked_at + self.config.freeze_period as i64 > now,
            StakingError::FreezePeriod
        );

        //calculate reward
        let reward_point = (self.config.points_per_stake as i64
            * (now - self.stake_account.staked_at))
            / YEAR_IN_SECS;

        //transfer unstaking nft
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: self.vault.to_account_info(),
                    mint: self.mint.to_account_info(),
                    to: self.user_ata.to_account_info(),
                    authority: self.stake_account.to_account_info(),
                },
                &[&[
                    STAKE_SEED,
                    self.user.key().as_ref(),
                    self.mint.key().as_ref(),
                    &[self.stake_account.bump],
                ]],
            ),
            1,
            0,
        )?;

        //close vault account
        token_interface::close_account(CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            token_interface::CloseAccount {
                account: self.vault.to_account_info(),
                destination: self.user.to_account_info(),
                authority: self.stake_account.to_account_info(),
            },
            &[&[
                STAKE_SEED,
                self.user.key().as_ref(),
                self.mint.key().as_ref(),
                &[self.stake_account.bump],
            ]],
        ))?;

        //update reward points for the user
        self.user_account.amount_staked -= 1;
        self.user_account.points += reward_point as u32;

        Ok(())
    }
}
