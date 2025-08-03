use anchor_lang::prelude::*;
use anchor_spl::token_interface;

use crate::constants::{CONFIG_SEED, REWARD_MINT_SEED};
use crate::state::Config;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        seeds = [CONFIG_SEED],
        bump,
        space = 8 + Config::INIT_SPACE,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = admin,
        seeds = [REWARD_MINT_SEED, config.key().as_ref()],
        bump,
        mint::decimals = 6,
        mint::authority = config,
        mint::freeze_authority = config,
        mint::token_program = token_program
    )]
    pub reward_mint: InterfaceAccount<'info, token_interface::Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,

    //standard pattern for initializing a persistent account is to include a rent sysvar in its context
    //so anchor has the access to rent exempt information at the time of account initialization
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> InitializeConfig<'info> {
    pub fn handler(
        &mut self,
        points_per_stake: u8,
        max_unstake: u8,
        freeze_period: u32,
        bumps: InitializeConfigBumps,
    ) -> Result<()> {
        self.config.set_inner(Config {
            points_per_stake,
            max_unstake,
            freeze_period,
            rewards_bump: bumps.reward_mint,
            bump: bumps.config,
        });
        Ok(())
    }
}
