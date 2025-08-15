use std::ops::AddAssign;

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface;

use crate::constants::{CONFIG_SEED, DISCRIMINATOR};
use crate::error::AaasError;
use crate::AaasConfig;

#[derive(Accounts)]
///Global config to govern all the services
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        seeds = [CONFIG_SEED],
        bump,
        space = DISCRIMINATOR + AaasConfig::INIT_SPACE,
    )]
    pub config: Account<'info, AaasConfig>,

    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = admin,
    )]
    pub treasury: InterfaceAccount<'info, token_interface::TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, token_interface::Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Initialize<'info> {
    pub fn handler(
        &mut self,
        signers: Vec<Pubkey>,
        threshold: u8,
        bumps: InitializeBumps,
        remaining_accounts: &[AccountInfo],
    ) -> Result<()> {
        msg!("Welcome to Aaas!");

        //verify the multi sig
        let mut sign_cnt = 0u8;
        for acc in remaining_accounts {
            if acc.is_signer && signers.contains(&acc.key()) {
                sign_cnt.add_assign(1);
            }
        }
        //check for signer threshold
        require!(sign_cnt >= threshold, AaasError::MutliSignerThreshold);

        self.config.set_inner(AaasConfig {
            signers,
            threshold,
            bump: bumps.config,
            admin: self.admin.key(),
        });
        Ok(())
    }
}
