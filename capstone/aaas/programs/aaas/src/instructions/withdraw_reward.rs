use anchor_lang::prelude::*;
use anchor_spl::token_interface;

use crate::constants::{CANDIDATE_SEED, CHALLENGE_SEED, CONFIG_SEED, SERVICE_SEED};
use crate::error::AaasError;
use crate::{AaasConfig, CandidateAccount, Challenge, Service, VALIDATION_PERIOD};

#[derive(Accounts)]
pub struct WithdrawReward<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,

    #[account(
        seeds = [CANDIDATE_SEED, challenge.service.as_ref(), challenge.key().as_ref(), winner.key().as_ref()],
        bump = winner_account.bump,
        has_one = challenge,
        constraint = winner.key() == winner_account.candidate.key()
    )]
    pub winner_account: Account<'info, CandidateAccount>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, AaasConfig>,

    #[account(
        seeds = [SERVICE_SEED, service.id.key().as_ref()],
        bump = service.bump
    )]
    pub service: Account<'info, Service>,

    #[account(
        seeds = [CHALLENGE_SEED, challenge.service.as_ref(), challenge.id.key().as_ref()],
        bump = challenge.bump,
        has_one = service,
    )]
    pub challenge: Account<'info, Challenge>,

    /// this is expected to be already exist Token Account for usdc
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = config.admin,
    )]
    pub treasury: InterfaceAccount<'info, token_interface::TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = challenge
    )]
    pub vault: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = winner,
    )]
    pub winner_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    pub token_program: Interface<'info, token_interface::TokenInterface>,
}

impl<'info> WithdrawReward<'info> {
    pub fn handler(&mut self) -> Result<()> {
        //check if the validate period is over
        let now = Clock::get()?.unix_timestamp as u64;
        require!(
            now > self
                .challenge
                .end_time
                .checked_add(VALIDATION_PERIOD)
                .unwrap(),
            AaasError::ValidationPeriod
        );
        msg!("withdraw reward is as per the time");

        // Acceptance rate check
        let acceptance_rate = self
            .winner_account
            .acceptance
            .checked_mul(10_000) //multiplication first before division gives more precision
            .unwrap()
            .checked_div(self.challenge.candidate_count as u16)
            .unwrap();

        require!(
            acceptance_rate >= self.challenge.winning_threshold,
            AaasError::WinningThreshold
        );
        msg!(
            "withdraw reward falls short of acceptance rate of {} with {} acceptance",
            acceptance_rate,
            self.winner_account.acceptance
        );

        // Reward calculation
        let losers = self.challenge.candidate_count - self.challenge.winner_count; //reduce repeated data fetching
        let pre_tax_reward = self
            .challenge
            .stake_amnt
            .checked_mul(losers as u64)
            .unwrap()
            .checked_div(self.challenge.winner_count as u64)
            .unwrap();

        // Fee calculation
        const PERCENT_DIVISOR: u64 = 100;
        let tax = pre_tax_reward
            .checked_mul(self.service.fee as u64)
            .unwrap()
            .checked_div(PERCENT_DIVISOR)
            .unwrap();

        //transfer fee
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: self.vault.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.treasury.to_account_info(),
                    authority: self.challenge.to_account_info(),
                },
                &[&[
                    CHALLENGE_SEED,
                    self.challenge.service.key().as_ref(),
                    self.challenge.id.key().as_ref(),
                    &[self.challenge.bump],
                ]],
            ),
            tax,
            self.usdc_mint.decimals,
        )?;

        //transfer reward
        let reward = pre_tax_reward - tax;
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: self.vault.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.winner_ata.to_account_info(),
                    authority: self.winner.to_account_info(),
                },
                &[&[
                    CHALLENGE_SEED,
                    self.challenge.service.key().as_ref(),
                    self.challenge.id.key().as_ref(),
                    &[self.challenge.bump],
                ]],
            ),
            reward,
            self.usdc_mint.decimals,
        )?;

        //update candiate account
        self.winner_account.rewarded = true;

        Ok(())
    }
}
