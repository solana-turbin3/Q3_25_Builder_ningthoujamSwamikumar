use anchor_lang::prelude::*;

use crate::constants::{CONFIG_SEED, DISCRIMINATOR, TREASURY_SEED};
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

    /// CHECK: this account is safe
    #[account(
        init,
        payer = admin,
        seeds = [TREASURY_SEED],
        bump,
        space = DISCRIMINATOR
    )]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn handler(
        &mut self,
        signers: Vec<Pubkey>,
        threshold: u8,
        bumps: InitializeBumps,
    ) -> Result<()> {
        self.config.set_inner(AaasConfig {
            signers,
            threshold,
            bump: bumps.config,
            treasury_bump: bumps.treasury,
        });
        Ok(())
    }
}
