use anchor_lang::prelude::*;

#[error_code]
pub enum DiceErrorCode {
    #[msg("Invalid program id!")]
    UnexpectedProgram,

    #[msg("Invalid accounts!")]
    UnexpectedAccounts,

    #[msg("Invalid signatures!")]
    UnexpectedSignatures,

    #[msg("Signature is expected to be verifiable!")]
    UnverifiableSignature,

    #[msg("Invalid signer")]
    UnexpectedSigner,

    #[msg("Signature not matching with the provided signature")]
    UnexpectedSignature,

    #[msg("Invalid message in the signature")]
    UnexpectedMessage,
}
