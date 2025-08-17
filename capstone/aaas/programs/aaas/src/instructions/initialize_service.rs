use std::ops::AddAssign;

use anchor_lang::prelude::*;

use crate::constants::{CONFIG_SEED, SERVICE_SEED};
use crate::error::AaasError;
use crate::{AaasConfig, Service};

#[derive(Accounts)]
#[instruction(id: Pubkey)]
pub struct InitService<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(
        init,
        payer = initializer,
        seeds = [SERVICE_SEED, id.key().as_ref()],
        bump,
        space = 8 + Service::INIT_SPACE,
    )]
    pub service: Account<'info, Service>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, AaasConfig>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitService<'info> {
    pub fn handler(
        &mut self,
        id: Pubkey,
        fee: u16,
        bumps: InitServiceBumps,
        remaining_accounts: &[AccountInfo],
    ) -> Result<()> {
        //confirm the multi sig
        //count the signers
        let mut signer_cnt = 0u8;
        for acc in remaining_accounts {
            if acc.is_signer && self.config.signers.contains(&acc.key()) {
                signer_cnt.add_assign(1);
            }
        }
        //check if signer reache threshold
        require!(
            signer_cnt >= self.config.threshold,
            AaasError::MutliSignerThreshold
        );

        //set the service account
        self.service.set_inner(Service {
            id,
            bump: bumps.service,
            fee,
        });
        Ok(())
    }
}
