use anchor_lang::prelude::*;

#[error_code]
pub enum AaasError {
    #[msg("Challenge started!")]
    ChallengeStarted,

    #[msg("Challenge ended!")]
    ChallengeEnded,

    #[msg("Validation period exceeded!")]
    ValidationPeriodEnded,

    #[msg("Validation period is going on!")]
    ValidationPeriod,

    #[msg("Winning threshold is required!")]
    WinningThreshold,

    #[msg("Multi-Signer threshold is violated!")]
    MutliSignerThreshold,
}
