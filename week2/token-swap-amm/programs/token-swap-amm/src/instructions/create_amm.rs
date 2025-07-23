use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::Amm;

#[derive(Accounts)]
#[instruction(id:u64, fee:u64)]
pub struct CreateAmm<'info> {
    #[account(mut)]
    pub signer: Signer<'info>, //signer

    pub admin: SystemAccount<'info>, //admin

    #[account(
        init,
        payer = signer,
        space = 8 + Amm::INIT_SPACE,
        seeds = [id.to_le_bytes().as_ref()],
        bump,
        constraint = fee < 10000 @ ErrorCode::InvalidFee,
    )]
    pub amm: Account<'info, Amm>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateAmm>, id: u64, fee: u64) -> Result<()> {
    ctx.accounts.amm.set_inner(Amm {
        id,
        admin: ctx.accounts.admin.key(),
        fee,
    });

    Ok(())
}
