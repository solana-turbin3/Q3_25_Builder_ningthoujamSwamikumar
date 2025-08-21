use anchor_instruction_sysvar::Ed25519InstructionSignatures;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::hash::hash;
use anchor_lang::solana_program::sysvar::instructions::load_instruction_at_checked;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_lang::{prelude::*, solana_program};

use crate::constants::{BET_SEED, VAULT_SEED};
use crate::error::DiceErrorCode;
use crate::Bet;

#[derive(Accounts)]
pub struct ResolveBet<'info> {
    #[account(mut)]
    pub house: Signer<'info>,

    #[account(mut)]
    pub player: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, house.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [BET_SEED, house.key().as_ref(), bet.player.key().as_ref()],
        bump = bet.bump,
        has_one = player,
        close = player,
    )]
    pub bet: Account<'info, Bet>,

    pub system_program: Program<'info, System>,

    /// CHECK: this is read only account
    #[account(
        address = solana_program::sysvar::instructions::ID
    )]
    pub instruction_sysvar: AccountInfo<'info>,
}

impl<'info> ResolveBet<'info> {
    pub fn verify_ed25519_signature(&mut self, sig: &[u8; 64]) -> Result<()> {
        //grab the first instruction in the
        let ix = load_instruction_at_checked(0, &self.instruction_sysvar.to_account_info())?;

        require_keys_eq!(
            ix.program_id,
            ed25519_program::ID,
            DiceErrorCode::UnexpectedProgram
        );

        require_eq!(ix.accounts.len(), 0, DiceErrorCode::UnexpectedAccounts);

        let signatures = Ed25519InstructionSignatures::unpack(&ix.data)?.0;
        require_eq!(signatures.len(), 1, DiceErrorCode::UnexpectedSignatures);

        let signature = &signatures[0];
        require!(
            signature.is_verifiable,
            DiceErrorCode::UnverifiableSignature
        );

        require!(
            signature.public_key == Some(self.house.key()),
            DiceErrorCode::UnexpectedSigner
        );

        require!(
            signature.signature == Some(*sig),
            DiceErrorCode::UnexpectedSignature
        );

        require!(
            signature.message.as_ref().unwrap().eq(&self.bet.to_slice()),
            DiceErrorCode::UnexpectedMessage
        );

        Ok(())
    }

    pub fn resolve_bet(&mut self, sig: &[u8; 64], bumps: ResolveBetBumps) -> Result<()> {
        let hash = hash(sig).to_bytes();
        let mut hash_16: [u8; 16] = [0; 16];
        hash_16.copy_from_slice(&hash[0..16]); //coz from_le_bytes below expects fixed size byte array

        let lower = u128::from_le_bytes(hash_16);

        hash_16.copy_from_slice(&hash[16..]);
        let upper = u128::from_le_bytes(hash_16);

        let roll = lower.wrapping_add(upper).wrapping_rem(100) as u8 + 1;

        if self.bet.roll < roll {
            //player lose the bet
            return Ok(());
        }

        //player wins the bet, so transfer mulitplier of his bet, after keeping somer percent as house edge to reduce fairness
        let payout = (self.bet.amnt as u128)
            .checked_mul(10000 - 150 as u128) //150 is 1.5% as the house edge
            .unwrap()
            .checked_div((self.bet.roll - 1) as u128) //divided by winning window, considering the bet was on "rolling under X" => smaller the roll => smaller the winning window => larger the prize
            .unwrap()
            .checked_div(100) //because we multiplied by 10000 as 100% ealier, this is to normalized back to correct value
            .unwrap();

        transfer(
            CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.vault.to_account_info(),
                    to: self.player.to_account_info(),
                },
                &[&[VAULT_SEED, self.house.key().as_ref(), &[bumps.vault]]],
            ),
            payout as u64,
        )
    }
}
