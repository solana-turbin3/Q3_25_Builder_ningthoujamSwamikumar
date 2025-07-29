use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{self, TokenInterface};

use crate::{constants::*};
use crate::{amm_error::AmmErrorCode, Amm, Pool};

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [amm.id.key().as_ref()],
        bump
    )]
    pub amm: Account<'info, Amm>,

    pub mint_a: InterfaceAccount<'info, token_interface::Mint>,

    pub mint_b: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        init,
        payer = creator,
        seeds = [amm.key().as_ref(), mint_a.key().as_ref(), mint_b.key().as_ref(), LIQUIDITY_SEED],
        bump,
        mint::decimals = 6,
        mint::authority = pool_authority,
    )]
    pub mint_liquidity: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        init,
        payer = creator,
        seeds = [amm.key().as_ref(), mint_a.key().as_ref(), mint_b.key().as_ref()],
        bump,
        space = 8 + Pool::INIT_SPACE
    )]
    pub pool: Account<'info, Pool>,

    ///CHECK: Read only authority
    #[account(
        seeds = [amm.key().as_ref(), mint_a.key().as_ref(), mint_b.key().as_ref(), AUTHORITY_SEED],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = mint_a,
        associated_token::authority = pool_authority,
        associated_token::token_program = token_program
    )]
    pub pool_account_a: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = mint_b,
        associated_token::authority = pool_authority,
        associated_token::token_program = token_program
    )]
    pub pool_account_b: InterfaceAccount<'info, token_interface::TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<CreatePool>) -> Result<()> {
    require!(
        ctx.accounts.mint_a.key().to_bytes() < ctx.accounts.mint_b.key().to_bytes(),
        AmmErrorCode::TokenMintOrderError
    );
    ctx.accounts.pool.set_inner(Pool {
        amm: ctx.accounts.amm.key(),
        mint_a: ctx.accounts.mint_a.key(),
        mint_b: ctx.accounts.mint_b.key(),
    });
    Ok(())
}
