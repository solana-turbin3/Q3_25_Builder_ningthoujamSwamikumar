use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface,
};

use crate::constants::{LISTING_ACCOUNT_SEED, MARKET_SEED, TREASURY_SEED};
use crate::{ListingAccount, Marketplace};

#[derive(Accounts)]
pub struct Purchase<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut)]
    pub seller: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = listing_account,
    )]
    pub vault: InterfaceAccount<'info, token_interface::TokenAccount>,

    pub mint: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        mut,
        seeds = [LISTING_ACCOUNT_SEED, 
        marketplace.key().as_ref(), 
        listing_account.owner.key().as_ref(), 
        listing_account.mint.key().as_ref()],
        bump = listing_account.bump,
        has_one = mint,
        close = seller,
    )]
    pub listing_account: Account<'info, ListingAccount>,

    #[account(
        seeds = [MARKET_SEED],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, marketplace.key().as_ref()],
        bump
    )]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl <'info> Purchase<'info> {
    pub fn handler(&mut self)->Result<()> {
        //check if the user has enough balance for price and fee

        //transfer price from buyer to seller
        transfer(CpiContext::new(self.system_program.to_account_info(), Transfer {
            from: self.buyer.to_account_info(),
            to: self.seller.to_account_info(),
        }), self.listing_account.price as u64)?;

        //transfer fee from buyer to treasury
        transfer(CpiContext::new(self.system_program.to_account_info(), Transfer {
            from: self.buyer.to_account_info(),
            to: self.treasury.to_account_info(),
        }), self.marketplace.fee as u64)?;

        //transfer nft
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(), 
                token_interface::TransferChecked { 
                    from: self.vault.to_account_info(), 
                    mint: self.mint.to_account_info(), 
                    to: self.buyer_ata.to_account_info(), 
                    authority: self.listing_account.to_account_info() 
                }, 
                &[&[
                    LISTING_ACCOUNT_SEED, 
                self.marketplace.key().as_ref(), 
                self.seller.key().as_ref(), 
                self.mint.key().as_ref()
                ]]), 
                1, 0)?;   

        //close vault
        token_interface::close_account(
            CpiContext::new_with_signer(
                self.associated_token_program.to_account_info(), 
                token_interface::CloseAccount { 
                    account: self.vault.to_account_info(),
                    destination: self.seller.to_account_info(), 
                    authority: self.listing_account.to_account_info() 
                }, 
                &[&[
                LISTING_ACCOUNT_SEED,
                self.marketplace.key().as_ref(),
                self.seller.key().as_ref(),
                self.mint.key().as_ref(),
                &[self.listing_account.bump]
        ]]
    ))?;

        Ok(())
    }
}
