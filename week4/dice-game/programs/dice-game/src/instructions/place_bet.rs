use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::constants::{BET_SEED, VAULT_SEED};
use crate::Bet;

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    pub house: SystemAccount<'info>,

    #[account(
        init,
        payer = player,
        seeds = [BET_SEED, house.key().as_ref(), player.key().as_ref()],
        bump,
        space = 8 + Bet::INIT_SPACE,
    )]
    pub bet: Account<'info, Bet>,

    #[account(
        mut,
        seeds = [VAULT_SEED, house.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> PlaceBet<'info> {
    pub fn place_bet(
        &mut self,
        seed: u128,
        roll: u8,
        amnt: u64,
        bumps: PlaceBetBumps,
    ) -> Result<()> {
        transfer(
            CpiContext::new(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.player.to_account_info(),
                    to: self.vault.to_account_info(),
                },
            ),
            amnt,
        )?;

        self.bet.set_inner(Bet {
            amnt,
            bump: bumps.bet,
            player: self.player.key(),
            roll,
            seed,
            slot: Clock::get()?.slot,
        });

        Ok(())
    }
}
