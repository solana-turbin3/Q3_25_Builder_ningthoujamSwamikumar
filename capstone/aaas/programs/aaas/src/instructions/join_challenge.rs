use anchor_lang::prelude::*;
use anchor_spl::token_interface;

use crate::constants::{CANDIDATE_SEED, CHALLENGE_SEED, DISCRIMINATOR};
use crate::{CandidateAccount, Challenge};

#[derive(Accounts)]
#[instruction(id: Pubkey)]
pub struct JoinChallenge<'info> {
    #[account(mut)]
    pub candidate: Signer<'info>,

    #[account(
        seeds = [CHALLENGE_SEED, challenge.service_key.key().as_ref(), challenge.id.key().as_ref()],
        bump = challenge.bump
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        init,
        payer = candidate,
        seeds = [CANDIDATE_SEED, challenge.service_key.key().as_ref(), challenge.key().as_ref(), candidate.key().as_ref()],
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
    pub fn handler(&mut self, _bump: u8) -> Result<()> {
        //transfer stake amnt from candidate ata to vault
        //initialize candidate account
        Ok(())
    }
}
