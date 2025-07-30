use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, TokenInterface},
};
use fixed::types::I64F64;

use crate::{amm_error::AmmErrorCode, constants, Amm, Pool};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [amm.id.key().as_ref()],
        bump
    )]
    pub amm: Account<'info, Amm>,

    pub mint_a: Box<InterfaceAccount<'info, token_interface::Mint>>,

    pub mint_b: Box<InterfaceAccount<'info, token_interface::Mint>>,

    #[account(
        mut,
        seeds = [amm.key().as_ref(), mint_a.key().as_ref(), mint_b.key().as_ref(), constants::LIQUIDITY_SEED],
        bump,
        mint::authority = pool_authority,
        mint::decimals = 6
    )]
    pub mint_liquidity: Box<InterfaceAccount<'info, token_interface::Mint>>,

    #[account(
        seeds = [pool.amm.key().as_ref(), pool.mint_a.key().as_ref(), pool.mint_b.key().as_ref()],
        bump,
        has_one = mint_a,
        has_one = mint_b,
    )]
    pub pool: Account<'info, Pool>,

    ///CHECK: this account is used as a read only account
    #[account(
        seeds = [amm.key().as_ref(), mint_a.key().as_ref(), mint_b.key().as_ref(), constants::AUTHORITY_SEED],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = pool_authority,
        associated_token::token_program = token_program
    )]
    pub pool_account_a: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = pool_authority,
        associated_token::token_program = token_program,
    )]
    pub pool_account_b: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = user,
        associated_token::token_program = token_program
    )]
    pub user_account_a: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_account_b: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_liquidity,
        associated_token::authority = user,
        associated_token::token_program = token_program
    )]
    pub user_account_liquidity: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    //check if the user has enough lp tokens
    require!(
        amount <= ctx.accounts.user_account_liquidity.amount,
        AmmErrorCode::InsufficientTokenBalance
    );

    //calculate the output token amounts
    let output_a = I64F64::from_num(amount)
        .checked_mul(I64F64::from_num(ctx.accounts.pool_account_a.amount))
        .unwrap()
        .checked_div(
            I64F64::from_num(ctx.accounts.mint_liquidity.supply)
                .checked_add(I64F64::from_num(constants::MINIMUM_LIQUIDITY))
                .unwrap(),
        )
        .unwrap()
        .floor()
        .to_num::<u64>();
    let output_b = I64F64::from_num(amount)
        .checked_mul(I64F64::from_num(ctx.accounts.pool_account_b.amount))
        .unwrap()
        .checked_div(
            I64F64::from_num(ctx.accounts.mint_liquidity.supply)
                .checked_add(I64F64::from_num(constants::MINIMUM_LIQUIDITY))
                .unwrap(),
        )
        .unwrap()
        .floor()
        .to_num::<u64>();

    //transfer tokens to user
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token_interface::TransferChecked {
                from: ctx.accounts.pool_account_a.to_account_info(),
                mint: ctx.accounts.mint_a.to_account_info(),
                to: ctx.accounts.user_account_a.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            &[&[
                ctx.accounts.amm.key().as_ref(),
                ctx.accounts.mint_a.key().as_ref(),
                ctx.accounts.mint_b.key().as_ref(),
                constants::AUTHORITY_SEED,
                &[ctx.bumps.pool_authority],
            ]],
        ),
        output_a,
        ctx.accounts.mint_a.decimals,
    )?;
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token_interface::TransferChecked {
                from: ctx.accounts.pool_account_b.to_account_info(),
                mint: ctx.accounts.mint_b.to_account_info(),
                to: ctx.accounts.user_account_b.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            &[&[
                ctx.accounts.amm.key().as_ref(),
                ctx.accounts.mint_a.key().as_ref(),
                ctx.accounts.mint_b.key().as_ref(),
                constants::AUTHORITY_SEED,
                &[ctx.bumps.pool_authority],
            ]],
        ),
        output_b,
        ctx.accounts.mint_b.decimals,
    )?;

    //burn the liquidity token used to withdraw
    token_interface::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token_interface::Burn {
                mint: ctx.accounts.mint_liquidity.to_account_info(),
                from: ctx.accounts.user_account_liquidity.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )
}
