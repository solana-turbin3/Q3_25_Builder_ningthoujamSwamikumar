use std::ops::AddAssign;

use anchor_lang::prelude::*;
use anchor_spl::token_interface;

use crate::constants::{CANDIDATE_SEED, CHALLENGE_SEED, DISCRIMINATOR};
use crate::error::AaasError;
use crate::{CandidateAccount, Challenge};

#[derive(Accounts)]
pub struct JoinChallenge<'info> {
    #[account(mut)]
    pub candidate: Signer<'info>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, challenge.service.key().as_ref(), challenge.id.key().as_ref()],
        bump = challenge.bump
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        init,
        payer = candidate,
        seeds = [CANDIDATE_SEED, challenge.service.key().as_ref(), challenge.key().as_ref(), candidate.key().as_ref()],
        bump,
        space = DISCRIMINATOR + CandidateAccount::INIT_SPACE
    )]
    pub candidate_account: Account<'info, CandidateAccount>,

    pub usdc_mint: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = challenge,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = candidate,
        associated_token::token_program = token_program
    )]
    pub candidate_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}

impl<'info> JoinChallenge<'info> {
    pub fn handler(&mut self, bump: u8) -> Result<()> {
        //check if challenge already started
        let now = Clock::get()?.unix_timestamp as u64;
        require!(now < self.challenge.start_time, AaasError::ChallengeStarted);
        //transfer stake amnt from candidate ata to vault
        token_interface::transfer_checked(
            CpiContext::new(
                self.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: self.candidate_ata.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.vault.to_account_info(),
                    authority: self.candidate.to_account_info(),
                },
            ),
            self.challenge.stake_amnt,
            self.usdc_mint.decimals,
        )?;
        //initialize candidate account
        self.candidate_account.candidate = self.candidate.key();
        self.candidate_account.challenge = self.challenge.key();
        self.candidate_account.bump = bump;
        self.candidate_account.rewarded = false;

        //update candidate count in challenge
        self.challenge.candidate_count.add_assign(1);

        Ok(())
    }
}
