use std::ops::SubAssign;

use anchor_lang::prelude::*;

use crate::constants::{CANDIDATE_SEED, CHALLENGE_SEED};
use crate::error::AaasError;
use crate::{CandidateAccount, Challenge};

#[derive(Accounts)]
pub struct ExitChallenge<'info> {
    #[account(mut)]
    pub candidate: Signer<'info>,

    #[account(
        seeds = [CHALLENGE_SEED, challenge.service.key().as_ref(), challenge.id.key().as_ref()],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        mut,
        seeds = [CANDIDATE_SEED, challenge.service.key().as_ref(), challenge.key().as_ref(), candidate_account.candidate.key().as_ref()],
        bump = candidate_account.bump,
        has_one = challenge,
        has_one = candidate,
        close = candidate,
    )]
    pub candidate_account: Account<'info, CandidateAccount>,

    pub system_program: Program<'info, System>,
}

impl<'info> ExitChallenge<'info> {
    pub fn handler(&mut self) -> Result<()> {
        //check if the challenge has started
        let now = Clock::get()?.unix_timestamp as u64;
        require!(now < self.challenge.start_time, AaasError::ChallengeStarted);

        //update candidate_count in challenge
        self.challenge.candidate_count.sub_assign(1);

        Ok(())
    }
}
