use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::Amm;

#[derive(Accounts)]
#[instruction(id:Pubkey, fee:u16)]
pub struct CreateAmm<'info> {
    #[account(mut)]
    pub signer: Signer<'info>, //signer

    pub admin: SystemAccount<'info>, //admin

    #[account(
        init,
        payer = signer,
        space = 8 + Amm::INIT_SPACE,
        seeds = [id.key().as_ref()],
        bump,
        constraint = fee < 10000 @ ErrorCode::InvalidFee,
    )]
    pub amm: Account<'info, Amm>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateAmm>, id: Pubkey, fee: u16) -> Result<()> {
    ctx.accounts.amm.set_inner(Amm {
        id,
        admin: ctx.accounts.admin.key(),
        fee,
    });

    Ok(())
}
