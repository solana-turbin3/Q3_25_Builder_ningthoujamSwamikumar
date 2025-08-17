use std::ops::{Add, AddAssign};

use anchor_lang::prelude::*;

use crate::constants::{
    CANDIDATE_SEED, CHALLENGE_SEED, DISCRIMINATOR, VALIDATE_SEED, VALIDATION_PERIOD,
};
use crate::error::AaasError;
use crate::{CandidateAccount, Challenge};

#[derive(Accounts)]
pub struct ValidateProof<'info> {
    #[account(mut)]
    pub validator: Signer<'info>,

    #[account(
        seeds = [CHALLENGE_SEED, challenge.service.key().as_ref(), challenge.id.key().as_ref()],
        bump = challenge.bump
    )]
    pub challenge: Account<'info, Challenge>,

    /// validates the validator is also a candidate, and its not voting(validating) for himself
    #[account(
        seeds = [CANDIDATE_SEED, challenge.service.key().as_ref(), challenge.key().as_ref(), validator.key().as_ref()],
        bump = validator_account.bump,
        has_one = challenge,
        constraint = validator_account.candidate.key() == validator.key(),
        constraint = validator.key() != candidate_account.candidate.key(),
    )]
    pub validator_account: Account<'info, CandidateAccount>,

    /// validates the candidate for which the validator is voting
    #[account(
        mut,
        seeds = [CANDIDATE_SEED, challenge.service.key().as_ref(), challenge.key().as_ref(), candidate_account.candidate.key().as_ref()],
        bump = candidate_account.bump,
        has_one = challenge,
    )]
    pub candidate_account: Account<'info, CandidateAccount>,

    /// CHECK: this account doesn't need to be validated, as it is used only to validate the authenticity of a voting (validation)
    /// if this account is already exist, we don't allow the voting/validation
    #[account(
        init,
        payer = validator,
        seeds = [VALIDATE_SEED, challenge.service.key().as_ref(), challenge.key().as_ref(), candidate_account.key().as_ref(), validator.key().as_ref()],
        bump,
        space = DISCRIMINATOR
    )]
    pub validation: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> ValidateProof<'info> {
    pub fn handler(&mut self) -> Result<()> {
        //authenticity of vote is validate in the accounts, and the validator is also validated in accounts
        //check it is within validation period
        let now = Clock::get()?.unix_timestamp as u64;
        require!(
            now < self.challenge.end_time.add(VALIDATION_PERIOD),
            AaasError::ValidationPeriodEnded
        );

        //validation period is within challenge start, and 24 hrs after challenge end
        require!(
            now > self.challenge.start_time,
            AaasError::ChallengeNotStarted
        );

        //check if the candidate has proof submitted
        require!(
            !self.candidate_account.proof.is_empty(),
            AaasError::RequiredProof
        );

        //calculate existing acceptance rate
        let mut acceptance_rate = self
            .candidate_account
            .acceptance
            .checked_div(self.challenge.candidate_count as u16)
            .unwrap()
            .checked_mul(10000)
            .unwrap();
        //update the acceptance
        self.candidate_account.acceptance.add_assign(1);
        //update winner count in challenge, if its winning and not already counted
        if acceptance_rate >= self.challenge.winning_threshold {
            Ok(())
        } else {
            //new acceptance rate, after updating acceptance
            acceptance_rate = self
                .candidate_account
                .acceptance
                .checked_div(self.challenge.candidate_count as u16)
                .unwrap()
                .checked_mul(10000)
                .unwrap();
            if acceptance_rate >= self.challenge.winning_threshold {
                //reached winning threshold for the first time
                self.challenge.winner_count.add_assign(1);
            };

            Ok(())
        }
    }
}
