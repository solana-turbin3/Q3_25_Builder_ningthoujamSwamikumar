use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::{MasterEditionAccount, Metadata, MetadataAccount};
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface};

use crate::constants::{LISTING_ACCOUNT_SEED, MARKET_SEED};
use crate::{ListingAccount, Marketplace};

#[derive(Accounts)]
pub struct Listing<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [MARKET_SEED],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        init,
        payer = user,
        seeds = [LISTING_ACCOUNT_SEED, marketplace.key().as_ref(), user.key().as_ref(), listing_mint.key().as_ref()],
        bump,
        space = ListingAccount::INIT_SPACE
    )]
    pub listing_account: Account<'info, ListingAccount>,

    pub listing_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = listing_mint,
        associated_token::authority = listing_account,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = listing_mint,
        associated_token::authority = user,
    )]
    pub user_ata: InterfaceAccount<'info, TokenAccount>,

    //to verify the nft belongs to a collection
    pub collection_mint: InterfaceAccount<'info, Mint>,

    //verified the nft collection and collection verification
    #[account(
        seeds=[b"metadata", metadata_program.key().as_ref(), listing_mint.key().as_ref()],
        seeds::program = metadata_program.key(),
        bump,
        constraint = metadata.collection.as_ref().unwrap().key.as_ref() == collection_mint.key().as_ref(),
        constraint = metadata.collection.as_ref().unwrap().verified == true
    )]
    pub metadata: Account<'info, MetadataAccount>,

    //master edition account proves, this is a valid nft
    #[account(
        seeds = [b"metadata", metadata_program.key().as_ref(), listing_mint.key().as_ref(), b"edition"],
        seeds::program = metadata_program.key(),
        bump,
    )]
    pub master_edition: Account<'info, MasterEditionAccount>,

    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub metadata_program: Program<'info, Metadata>,
}

impl<'info> Listing<'info> {
    pub fn handler(&mut self, bumps: ListingBumps, price: u16) -> Result<()> {
        token_interface::transfer_checked(
            CpiContext::new(
                self.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: self.user_ata.to_account_info(),
                    mint: self.listing_mint.to_account_info(),
                    to: self.vault.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            ),
            1,
            0,
        )?;

        self.listing_account.set_inner(ListingAccount {
            owner: self.user.key(),
            mint: self.listing_mint.key(),
            price,
            bump: bumps.listing_account,
        });
        Ok(())
    }
}
