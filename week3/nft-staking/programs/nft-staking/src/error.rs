use anchor_lang::prelude::*;

#[error_code]
pub enum StakingError {
    #[msg("No staking found!")]
    NoStakeFound,

    #[msg("Can't unstake during freeze period!")]
    FreezePeriod,
}
