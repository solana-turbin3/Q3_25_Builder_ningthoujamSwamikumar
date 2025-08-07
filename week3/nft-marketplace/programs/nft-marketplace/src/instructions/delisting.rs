use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Token;
use anchor_spl::token_interface;

use crate::constants::{LISTING_ACCOUNT_SEED, MARKET_SEED};
use crate::{ListingAccount, Marketplace};

#[derive(Accounts)]
pub struct Delisting<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub mint: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = listing_account,
    )]
    pub vault: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        mut,
        seeds = [LISTING_ACCOUNT_SEED, marketplace.key().as_ref(), user.key().as_ref(), mint.key().as_ref()],
        bump = listing_account.bump,
        close = user,
        constraint = listing_account.owner.key() == user.key(),
        has_one = mint
    )]
    pub listing_account: Account<'info, ListingAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        seeds = [MARKET_SEED],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Delisting<'info> {
    pub fn handler(&mut self) -> Result<()> {
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: self.vault.to_account_info(),
                    mint: self.mint.to_account_info(),
                    to: self.user_ata.to_account_info(),
                    authority: self.listing_account.to_account_info(),
                },
                &[&[
                    LISTING_ACCOUNT_SEED,
                    self.marketplace.key().as_ref(),
                    self.user.key().as_ref(),
                    self.mint.key().as_ref(),
                    self.listing_account.bump.to_le_bytes().as_ref(),
                ]],
            ),
            1,
            0,
        )?;

        //close vault
        token_interface::close_account(CpiContext::new_with_signer(
            self.associated_token_program.to_account_info(),
            token_interface::CloseAccount {
                account: self.vault.to_account_info(),
                destination: self.user.to_account_info(),
                authority: self.listing_account.to_account_info(),
            },
            &[&[
                LISTING_ACCOUNT_SEED,
                self.marketplace.key().as_ref(),
                self.user.key().as_ref(),
                self.mint.key().as_ref(),
                self.listing_account.bump.to_le_bytes().as_ref(),
            ]],
        ))
    }
}
