use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface;

use crate::constants::{CHALLENGE_SEED, DISCRIMINATOR, SERVICE_SEED};
use crate::{Challenge, Service};

#[derive(Accounts)]
#[instruction(id:Pubkey)]
pub struct CreateChallenge<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [SERVICE_SEED, service.id.key().as_ref()],
        bump = service.bump,
    )]
    pub service: Account<'info, Service>,

    #[account(
        init,
        payer = creator,
        seeds = [CHALLENGE_SEED, service.key().as_ref(), id.key().as_ref()],
        bump,
        space = DISCRIMINATOR + Challenge::INIT_SPACE,
    )]
    pub challenge: Account<'info, Challenge>,

    pub usdc_mint: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = usdc_mint,
        associated_token::authority = challenge,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, token_interface::TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> CreateChallenge<'info> {
    pub fn handler(
        &mut self,
        id: Pubkey,
        start_time: u64,
        end_time: u64,
        stake_amnt: u64,
        proof: String,
        service_key: Pubkey,
        winning_threshold: u16,
        bumps: CreateChallengeBumps,
    ) -> Result<()> {
        self.challenge.set_inner(Challenge {
            id,
            start_time,
            end_time,
            stake_amnt,
            proof,
            service: service_key,
            bump: bumps.challenge,
            candidate_count: 0,
            winner_count: 0,
            winning_threshold,
        });
        Ok(())
    }
}
