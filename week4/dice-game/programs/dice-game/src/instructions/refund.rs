use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::{
    constants::{BET_SEED, VAULT_SEED},
    Bet,
};

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    pub house: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, house.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [BET_SEED, house.key().as_ref(), bet.player.key().as_ref()],
        bump = bet.bump,
        close = player,
        has_one = player
    )]
    pub bet: Account<'info, Bet>,

    pub system_program: Program<'info, System>,
}

impl<'info> Refund<'info> {
    pub fn refund(&mut self, bump: u8) -> Result<()> {
        //check for refund period, if any, else direct transfer
        transfer(
            CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.vault.to_account_info(),
                    to: self.player.to_account_info(),
                },
                &[&[VAULT_SEED, self.house.key().as_ref(), &[bump]]],
            ),
            self.bet.amnt,
        )
    }
}
