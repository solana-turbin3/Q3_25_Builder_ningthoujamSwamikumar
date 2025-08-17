use anchor_lang::prelude::*;

use crate::constants::{CANDIDATE_SEED, CHALLENGE_SEED};
use crate::error::AaasError;
use crate::{CandidateAccount, Challenge};

#[derive(Accounts)]
pub struct SubmitProof<'info> {
    #[account(mut)]
    pub candidate: Signer<'info>,

    #[account(
        seeds = [CHALLENGE_SEED, challenge.service.key().as_ref(), challenge.id.key().as_ref()],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        mut,
        seeds = [CANDIDATE_SEED, challenge.service.key().as_ref(), challenge.key().as_ref(), candidate.key().as_ref()],
        bump = candidate_account.bump,
        has_one = challenge,
        has_one = candidate,
    )]
    pub candidate_account: Account<'info, CandidateAccount>,
}

impl<'info> SubmitProof<'info> {
    pub fn handler(&mut self, proof: String) -> Result<()> {
        //check if the challenge has started
        let now = Clock::get()?.unix_timestamp as u64;
        require!(
            now > self.challenge.start_time,
            AaasError::ChallengeNotStarted
        );

        //check if challenge has ended, can't submit after challenge ends
        require!(now < self.challenge.end_time, AaasError::ChallengeEnded);

        //shouldn't allow resubmit
        require!(
            self.candidate_account.proof.is_empty(),
            AaasError::DuplicateProof
        );

        //save the proof, and initialized the acceptance at 0
        self.candidate_account.proof = proof;
        self.candidate_account.acceptance = 0u16;

        Ok(())
    }
}
