use std::ops::SubAssign;

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface;

use crate::constants::{CANDIDATE_SEED, CHALLENGE_SEED};
use crate::error::AaasError;
use crate::{CandidateAccount, Challenge};

#[derive(Accounts)]
pub struct ExitChallenge<'info> {
    #[account(mut)]
    pub candidate: Signer<'info>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, challenge.service.key().as_ref(), challenge.id.key().as_ref()],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    ///candidate_account.candidate shouldn't be used
    /// because at the time account close, anchor won't reference seeds from an account which is going to close
    #[account(
        mut,
        seeds = [CANDIDATE_SEED, challenge.service.key().as_ref(), challenge.key().as_ref(), candidate.key().as_ref()],
        bump,
        has_one = challenge,
        has_one = candidate,
        close = candidate,
    )]
    pub candidate_account: Account<'info, CandidateAccount>,

    pub usdc_mint: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = challenge,
    )]
    pub vault: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = candidate,
    )]
    pub candidate_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> ExitChallenge<'info> {
    pub fn handler(&mut self) -> Result<()> {
        //check if the challenge has started
        let now = Clock::get()?.unix_timestamp as u64;
        require!(now < self.challenge.start_time, AaasError::ChallengeStarted);

        //transfer back the stake amnt
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: self.vault.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.candidate_ata.to_account_info(),
                    authority: self.challenge.to_account_info(),
                },
                &[&[
                    CHALLENGE_SEED,
                    self.challenge.service.key().as_ref(),
                    self.challenge.id.key().as_ref(),
                    &[self.challenge.bump],
                ]],
            ),
            self.challenge.stake_amnt,
            self.usdc_mint.decimals,
        )?;

        //update candidate_count in challenge
        self.challenge.candidate_count.sub_assign(1);

        Ok(())
    }
}
