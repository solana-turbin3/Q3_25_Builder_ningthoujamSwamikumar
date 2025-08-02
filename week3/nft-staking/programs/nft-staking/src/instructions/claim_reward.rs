use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface;

use crate::constants::{CONFIG_SEED, REWARD_MINT_SEED, USER_SEED};
use crate::error::StakingError;
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
        bump = config.rewards_bump,
        mint::authority = config,
        mint::decimals = 6,
        mint::token_program = token_program
    )]
    pub reward_mint: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = reward_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_reward_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Claim<'info> {
    pub fn handler(&mut self) -> Result<()> {
        //assure the user has +ve reward points
        require!(self.user_account.points > 0, StakingError::NoRewardsToClaim);

        //mint the reward token to user reward ata
        token_interface::mint_to_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token_interface::MintToChecked {
                    mint: self.reward_mint.to_account_info(),
                    to: self.user_reward_ata.to_account_info(),
                    authority: self.config.to_account_info(),
                },
                &[&[CONFIG_SEED, &[self.config.bump]]],
            ),
            self.user_account.points as u64,
            self.reward_mint.decimals,
        )?;

        self.user_account.points = 0;

        Ok(())
    }
}
