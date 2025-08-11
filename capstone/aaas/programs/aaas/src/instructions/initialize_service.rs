use anchor_lang::prelude::*;

use crate::constants::SERVICE_SEED;
use crate::Service;

//TODO: use multisig to initialize service

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

    pub system_program: Program<'info, System>,
}

impl<'info> InitService<'info> {
    pub fn handler(
        &mut self,
        id: Pubkey,
        fee: u16,
        winning_threshold: u16,
        bumps: InitServiceBumps,
    ) -> Result<()> {
        self.service.set_inner(Service {
            id,
            bump: bumps.service,
            fee,
            winning_threshold,
        });
        Ok(())
    }
}
