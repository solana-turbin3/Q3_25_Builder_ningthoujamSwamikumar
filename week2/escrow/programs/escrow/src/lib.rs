use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface, //::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked, close_account, CloseAccount},
};

declare_id!("6Cd8qb7i2pknKX2VyHUZLJJJUCarhw9Eg26qfd7FXus8");

#[program]
pub mod escrow {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        offer_id: u64,
        offer_amnt: u64,
        ask_amnt: u64,
    ) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        let acc = ctx.accounts;

        //initialize the offer (escrow)
        acc.offer.set_inner(Offer {
            offer_amount: offer_amnt,
            offer_mint: acc.offer_mint.key(),
            ask_amount: ask_amnt,
            ask_mint: acc.ask_mint.key(),
            user: *acc.initializer.key,
            offer_id,
        });

        //transfer the token amount from users account to vault, in our case that would be offer_ata
        //construct cpi context, and do a cpi call
        let transfer_accounts = token_interface::TransferChecked {
            authority: acc.initializer.to_account_info(),
            from: acc.initializer_ata.to_account_info(),
            to: acc.vault.to_account_info(),
            mint: acc.offer_mint.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(acc.token_program.to_account_info(), transfer_accounts);

        token_interface::transfer_checked(cpi_ctx, offer_amnt, acc.offer_mint.decimals)
    }

    pub fn accept(ctx: Context<Accept>, offer_id: u64) -> Result<()> {
        let accnts = ctx.accounts;

        //transfer asked token from acceptors sending ata to initializers recieving ata
        token_interface::transfer_checked(
            CpiContext::new(
                accnts.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: accnts.acceptors_sending_ata.to_account_info(),
                    mint: accnts.asked_mint.to_account_info(),
                    to: accnts.initializers_recieving_ata.to_account_info(),
                    authority: accnts.acceptor.to_account_info(),
                },
            ),
            accnts.offer.ask_amount,
            accnts.asked_mint.decimals,
        )?;

        msg!("transferred asked token from acceptor to initiator");

        //transfer offered token from vault to acceptors recieving ata
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                accnts.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: accnts.vault.to_account_info(),
                    mint: accnts.offered_mint.to_account_info(),
                    to: accnts.acceptors_recieving_ata.to_account_info(),
                    authority: accnts.offer.to_account_info(),
                },
                &[&[
                    b"offer".as_ref(),
                    &offer_id.to_le_bytes(),
                    &[ctx.bumps.offer],
                ]],
            ),
            accnts.offer.offer_amount,
            accnts.asked_mint.decimals,
        )?;


        msg!("transferred offered token from vault to acceptors recieving ata");

        //close the vault
        //transfer any remaining tokens if any to the initializer
        if accnts.vault.amount - accnts.offer.offer_amount > 0 {
            token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    accnts.token_program.to_account_info(),
                    token_interface::TransferChecked {
                        from: accnts.vault.to_account_info(),
                        mint: accnts.offered_mint.to_account_info(),
                        to: accnts.initializers_sending_ata.to_account_info(),
                        authority: accnts.offer.to_account_info(),
                    },
                    &[&[
                        b"offer".as_ref(),
                        &offer_id.to_le_bytes().as_ref(),
                        &[ctx.bumps.offer],
                    ]],
                ),
                accnts.vault.amount,
                accnts.offered_mint.decimals,
            )?;
        }
        //close the vault account
        token_interface::close_account(CpiContext::new_with_signer(
            accnts.token_program.to_account_info(),
            token_interface::CloseAccount {
                account: accnts.vault.to_account_info(),
                authority: accnts.offer.to_account_info(),
                destination: accnts.initializer.to_account_info(),
            },
            &[&[
                b"offer",
                &offer_id.to_le_bytes().as_ref(),
                &[ctx.bumps.offer],
            ]],
        ))
    }
}

#[derive(Accounts)]
#[instruction(offer_id: u64)]
pub struct Accept<'info> {
    #[account(mut)]
    pub acceptor: Signer<'info>,

    #[account(mut)]
    pub initializer: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"offer", offer_id.to_le_bytes().as_ref()],
        bump,
        close = initializer,
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        mut,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
        associated_token::mint = offer.offer_mint
    )]
    pub vault: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        mut,
        associated_token::authority = acceptor,
        associated_token::mint = offer.ask_mint,
        associated_token::token_program = token_program,
    )]
    pub acceptors_sending_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        init_if_needed,
        payer = acceptor,
        associated_token::mint = offered_mint,
        associated_token::authority = acceptor,
        associated_token::token_program = token_program,
    )]
    pub acceptors_recieving_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        init_if_needed,
        payer = acceptor,
        associated_token::mint = asked_mint,
        associated_token::authority = initializer,
        associated_token::token_program = token_program,
    )]
    pub initializers_recieving_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        mut,
        associated_token::mint = offered_mint,
        associated_token::authority = initializer,
        associated_token::token_program = token_program,
    )]
    pub initializers_sending_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        mint::token_program = token_program,
        address = offer.offer_mint,
    )]
    pub offered_mint: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        mint::token_program = token_program,
        address = offer.ask_mint,
    )]
    pub asked_mint: InterfaceAccount<'info, token_interface::Mint>,

    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(offer_id: u64)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(
        init,
        payer = initializer,
        seeds = [b"offer", offer_id.to_le_bytes().as_ref()],
        bump,
        space = 8 + Offer::INIT_SPACE,
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        mint::token_program=token_program,
    )]
    pub offer_mint: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        mint::token_program=token_program,
    )]
    pub ask_mint: InterfaceAccount<'info, token_interface::Mint>,

    #[account(
        init_if_needed,
        payer=initializer,
        associated_token::mint = offer_mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, token_interface::TokenAccount>,

    #[account(
        mut,
        associated_token::mint = offer_mint,
        associated_token::authority = initializer,
        associated_token::token_program = token_program,
    )]
    pub initializer_ata: InterfaceAccount<'info, token_interface::TokenAccount>,

    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub offer_amount: u64,
    pub offer_mint: Pubkey,
    pub ask_mint: Pubkey,
    pub ask_amount: u64,
    pub user: Pubkey,
    pub offer_id: u64,
}
