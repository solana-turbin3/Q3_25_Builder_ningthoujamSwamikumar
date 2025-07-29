use anchor_lang::prelude::*;

#[error_code]
pub enum AmmErrorCode {
    #[msg("Custom error message")]
    CustomError,
    #[msg("Fee is more than or equal to max basis point")]
    InvalidFee,
    #[msg("Deposit doesn't satisfy the minimum initial threshold")]
    DepositTooSmall,
    #[msg("Token mint order is not satisfied")]
    TokenMintOrderError,
    #[msg("Token account doesn't have sufficient balance")]
    InsufficientTokenBalance,
    #[msg("Output is smaller than the min expected output!")]
    OuputTooSmall,
    #[msg("New invariant shouldn't be higher than existing invariant!")]
    InvariantViolated,
}
