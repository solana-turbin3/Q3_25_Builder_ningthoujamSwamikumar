use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface};
use fixed::types::I64F64;

use crate::{amm_error::AmmErrorCode, constants, Amm, Pool};

#[derive(Accounts)]
pub struct SwapToken<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub mint_a: InterfaceAccount<'info, token_interface::Mint>,

    pub mint_b: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        seeds = [amm.id.key().as_ref()],
        bump
    )]
    pub amm: Account<'info, Amm>,

    #[account(
        seeds = [amm.key().as_ref(), mint_a.key().as_ref(), mint_b.key().as_ref()],
        bump,
        has_one = mint_a,
        has_one = mint_b
    )]
    pub pool: Account<'info, Pool>,

    ///CHECK: used as read me authority account
    #[account(
        seeds = [pool.amm.key().as_ref(), pool.mint_a.key().as_ref(), pool.mint_b.key().as_ref(), constants::AUTHORITY_SEED],
        bump,
    )]
    pub pool_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = pool_authority,
        associated_token::token_program = token_program,
    )]
    pub pool_account_a: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = pool_authority,
        associated_token::token_program = token_program,
    )]
    pub pool_account_b: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint_a,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_account_a: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint_b,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_account_b: InterfaceAccount<'info, token_interface::TokenAccount>,

    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

/**
 * input_token should be smaller than output_token, and hence the mint_a will be input_token and so.
 */
pub fn handler(
    ctx: Context<SwapToken>,
    swap_a: bool,
    input_amount: u64,
    min_output_amount: u64,
) -> Result<()> {
    //check if the user has enough amounts of swap token
    require!(
        ctx.accounts.user_account_a.amount >= input_amount,
        AmmErrorCode::InsufficientTokenBalance
    );

    let tax_input = input_amount - (input_amount * ctx.accounts.amm.fee as u64 / 10000);

    //calculate the recieving amount
    //the invariant is maintained before and after the swap
    //poolA + txInput = newA  ;  poolB - output = newB
    //we must keep the product of the pools similar before and after, and thus found the output formula
    //output = (tax_input * B)/(A + tax_input)
    let output_amount = if swap_a {
        I64F64::from_num(tax_input)
            .checked_mul(I64F64::from_num(ctx.accounts.pool_account_b.amount))
            .unwrap()
            .checked_div(
                I64F64::from_num(ctx.accounts.pool_account_a.amount)
                    .checked_add(I64F64::from_num(tax_input))
                    .unwrap(),
            )
            .unwrap()
            .to_num::<u64>()
    } else {
        I64F64::from_num(tax_input)
            .checked_mul(I64F64::from_num(ctx.accounts.pool_account_a.amount))
            .unwrap()
            .checked_div(
                I64F64::from_num(ctx.accounts.pool_account_b.amount)
                    .checked_add(I64F64::from_num(tax_input))
                    .unwrap(),
            )
            .unwrap()
            .to_num::<u64>()
    };

    //check if the recieving amount is more than min amount provided
    require!(
        output_amount >= min_output_amount,
        AmmErrorCode::OuputTooSmall
    );

    //context and decimals for swap in and swap out
    let (swap_in_accounts, swap_out_accounts, swap_in_decimal, swap_out_decimal) = match swap_a {
        true => (
            token_interface::TransferChecked {
                from: ctx.accounts.user_account_a.to_account_info(),
                mint: ctx.accounts.mint_a.to_account_info(),
                to: ctx.accounts.pool_account_a.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
            token_interface::TransferChecked {
                from: ctx.accounts.pool_account_b.to_account_info(),
                mint: ctx.accounts.mint_b.to_account_info(),
                to: ctx.accounts.user_account_b.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            ctx.accounts.mint_a.decimals,
            ctx.accounts.mint_b.decimals,
        ),
        false => (
            token_interface::TransferChecked {
                from: ctx.accounts.user_account_b.to_account_info(),
                mint: ctx.accounts.mint_b.to_account_info(),
                to: ctx.accounts.pool_account_b.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
            token_interface::TransferChecked {
                from: ctx.accounts.pool_account_a.to_account_info(),
                mint: ctx.accounts.mint_a.to_account_info(),
                to: ctx.accounts.user_account_a.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            ctx.accounts.mint_b.decimals,
            ctx.accounts.mint_a.decimals,
        ),
    };

    //compute the invariant before trade
    let invariant = ctx.accounts.pool_account_a.amount * ctx.accounts.pool_account_b.amount;

    //transfer swap in token to vault
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            swap_in_accounts,
        ),
        tax_input,
        swap_in_decimal,
    )?;

    //transfer swap out token to user
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            swap_out_accounts,
            &[&[
                ctx.accounts.amm.key().as_ref(),
                ctx.accounts.mint_a.key().as_ref(),
                ctx.accounts.mint_b.key().as_ref(),
                constants::AUTHORITY_SEED,
                &[ctx.bumps.pool_authority],
            ]],
        ),
        output_amount,
        swap_out_decimal,
    )?;

    msg!(
        "Traded {} tokens ({} after fees) for {}",
        input_amount,
        tax_input,
        output_amount
    );

    //varify the invariant still holds
    //reload accounts because of the CPIs
    //we don't tolerate if the new invariant is higher because it means a rounding error for LPs
    ctx.accounts.pool_account_a.reload()?;
    ctx.accounts.pool_account_b.reload()?;
    require!(
        invariant <= ctx.accounts.pool_account_a.amount * ctx.accounts.pool_account_b.amount,
        AmmErrorCode::InvariantViolated
    );

    Ok(())
}
