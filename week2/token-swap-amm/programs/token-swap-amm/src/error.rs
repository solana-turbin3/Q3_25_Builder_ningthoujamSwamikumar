use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Custom error message")]
    CustomError,
    #[msg("Fee is more than or equal to max basis point")]
    InvalidFee,
    #[msg("Deposit doesn't satisfy the minimum initial threshold")]
    DepositTooSmall,
    #[msg("Token mint order is not satisfied")]
    TokenMintOrderError,
}
