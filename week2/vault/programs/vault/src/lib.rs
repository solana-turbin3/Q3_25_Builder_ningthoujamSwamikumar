use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

declare_id!("7xjzMP6rDzCEAp5anmRYHg5RfTxUZ5GTyp7ASf8cKoPj");

//Vault program keeps a particular asset in a safe account
//we will first need to create a vault
//only then we can deposit or withdraw tokens or assets

#[program]
pub mod vault {
    use super::*;

    /// initializes the vault
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        ctx.accounts.initialize(&ctx.bumps)
    }

    ///deposit to the vault
    pub fn deposit(ctx: Context<Payment>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

    ///withdraw from the vault
    pub fn withdraw(ctx: Context<Payment>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(&ctx.bumps, amount)
    }
}

#[derive(Accounts)]
pub struct Payment<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds=[b"state", user.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        mut,
        seeds=[b"vault", vault_state.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Payment<'info> {
    pub fn deposit(&self, amount: u64) -> Result<()> {
        let cpi_account = Transfer {
            from: self.user.to_account_info(),
            to: self.vault.to_account_info(),
        };
        let cpi_context = CpiContext::new(self.system_program.to_account_info(), cpi_account);
        transfer(cpi_context, amount)
    }

    pub fn withdraw(&self, bumps: &PaymentBumps, amount: u64) -> Result<()> {
        let cpi_account = Transfer {
            from: self.vault.to_account_info(),
            to: self.user.to_account_info(),
        };
        let vault_state_key = self.vault_state.key();
        let signer_seeds = &[b"vault", vault_state_key.as_ref(), &[bumps.vault]];
        let binding = [&signer_seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            self.system_program.to_account_info(),
            cpi_account,
            &binding,
        );

        transfer(cpi_context, amount)
    }
}

//initialize context
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer=user,
        seeds=[b"state", user.key().as_ref()],
        bump,
        space=8 + VaultState::INIT_SPACE,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds=[b"vault", vault_state.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self, bumps: &InitializeBumps) -> Result<()> {
        let rent_exempt =
            Rent::get()?.minimum_balance(self.vault_state.to_account_info().data_len());
        let cpi_accounts = Transfer {
            from: self.user.to_account_info(),
            to: self.vault.to_account_info(),
        };

        let cpi_context = CpiContext::new(self.system_program.to_account_info(), cpi_accounts);
        transfer(cpi_context, rent_exempt)?;

        self.vault_state.state_bump = bumps.vault_state;
        self.vault_state.vault_bump = bumps.vault;

        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    vault_bump: u8,
    state_bump: u8,
}
