use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface;
use fixed::types::I64F64;

use crate::constants;
use crate::amm_error::AmmErrorCode;
use crate::Pool;

#[derive(Accounts)]
pub struct DepositLiquidity<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    pub mint_a: Box<InterfaceAccount<'info, token_interface::Mint>>,

    pub mint_b: Box<InterfaceAccount<'info, token_interface::Mint>>,

    #[account(
        mut,
        seeds = [pool.amm.key().as_ref(), mint_a.key().as_ref(), mint_b.key().as_ref(), constants::LIQUIDITY_SEED.as_ref()],
        bump,
    )]
    pub mint_liquidity: Box<InterfaceAccount<'info, token_interface::Mint>>,

    #[account(
        seeds = [pool.amm.key().as_ref(), pool.mint_a.key().as_ref(), pool.mint_b.key().as_ref()],
        bump,
        has_one = mint_a,
        has_one = mint_b,
    )]
    pub pool: Box<Account<'info, Pool>>,

    ///CHECK: this account is being used as read only authority
    #[account(
        seeds = [
            pool.amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
            constants::AUTHORITY_SEED,
        ],
        bump,
    )]
    pub pool_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = pool_authority,
        associated_token::token_program = token_program,
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
        associated_token::authority = depositor,
        associated_token::token_program = token_program,
    )]
    pub depositor_ata_a: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = depositor,
        associated_token::token_program = token_program
    )]
    pub depositor_ata_b: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    #[account(
        init_if_needed,
        payer = depositor,
        associated_token::mint = mint_liquidity,
        associated_token::authority = depositor,
        associated_token::token_program = token_program,
        constraint = depositor_ata_liquidity.mint == mint_liquidity.key(),
        constraint = depositor_ata_liquidity.owner == depositor.key(),
    )]
    pub depositor_ata_liquidity: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}

pub fn handler(ctx: Context<DepositLiquidity>, amount_a: u64, amount_b: u64) -> Result<()> {
    //created lp token mint in accounts struct ✅

    //check token balances and take the minimum balance - prevents depositing tokens the depositor doesn't own
    let mut amount_a = if amount_a > ctx.accounts.depositor_ata_a.amount {
        ctx.accounts.depositor_ata_a.amount
    } else {
        amount_a
    };
    let mut amount_b = if amount_b > ctx.accounts.depositor_ata_b.amount {
        ctx.accounts.depositor_ata_b.amount
    } else {
        amount_b
    };

    //make sure they are provided in the same ratio of liquidity pools
    let pool_a = &ctx.accounts.pool_account_a;
    let pool_b = &ctx.accounts.pool_account_b;

    //defining the pool like this allow attackers to frontrun pool creation with bad ratios
    let pool_creation = pool_a.amount == 0 && pool_b.amount == 0;
    (amount_a, amount_b) = if pool_creation {
        (amount_a, amount_b)
    } else {
        //lets try to use all of user's provided pool_a amount
        let amount_b_optimal = amount_a
            .checked_mul(pool_a.amount)
            .unwrap()
            .checked_div(pool_b.amount)
            .unwrap();
        if amount_b_optimal > amount_b {
            //amount_b_optimal is more than the provided users limit
            //lets use all of users provided amount_b and calculate amount_a
            (
                amount_b
                    .checked_mul(pool_b.amount)
                    .unwrap()
                    .checked_div(pool_a.amount)
                    .unwrap(),
                amount_b,
            )
        } else {
            (amount_a, amount_b_optimal)
        }
    };

    //calculate amount of liquidity token
    //the lp token supply represents pool size, while it also directly and linearly proportionate to the amount of tokens deposited, so we are using geometric mean to calculate the amount of liquidity token
    let mut liquidity = I64F64::from_num(amount_a)
        .checked_mul(I64F64::from_num(amount_b))
        .unwrap()
        .sqrt()
        .to_num::<u64>();

    //lock minimum liquidity or prevent pool deposit, if initial pool creation
    if pool_creation {
        if liquidity < constants::MINIMUM_LIQUIDITY {
            return err!(AmmErrorCode::DepositTooSmall);
        }
        liquidity -= constants::MINIMUM_LIQUIDITY;
    }

    //then transfer the token into respective pool
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token_interface::TransferChecked {
                mint: ctx.accounts.mint_a.to_account_info(),
                from: ctx.accounts.depositor_ata_a.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
                to: ctx.accounts.pool_account_a.to_account_info(),
            },
        ),
        amount_a,
        ctx.accounts.mint_a.decimals,
    )?;
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token_interface::TransferChecked {
                mint: ctx.accounts.mint_b.to_account_info(),
                from: ctx.accounts.depositor_ata_b.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
                to: ctx.accounts.pool_account_b.to_account_info(),
            },
        ),
        amount_b,
        ctx.accounts.mint_b.decimals,
    )?;

    //mint lp tokens
    token_interface::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token_interface::MintTo {
                mint: ctx.accounts.mint_liquidity.to_account_info(),
                to: ctx.accounts.depositor_ata_liquidity.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            &[&[
                ctx.accounts.pool.amm.key().as_ref(),
                ctx.accounts.mint_a.key().as_ref(),
                ctx.accounts.mint_b.key().as_ref(),
                constants::AUTHORITY_SEED,
                &[ctx.bumps.pool_authority],
            ]],
        ),
        liquidity,
    )
}
