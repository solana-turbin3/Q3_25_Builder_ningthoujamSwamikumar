use anchor_lang::prelude::*;

pub const DISCRIMINATOR: usize = 8;

pub const VALIDATION_PERIOD: u64 = 60 * 60 * 24; //in seconds

#[constant]
pub const TREASURY_SEED: &[u8] = b"aaasTreasury";

#[constant]
pub const CONFIG_SEED: &[u8] = b"aaasConfig";

#[constant]
pub const SERVICE_SEED: &[u8] = b"aaasService";

#[constant]
pub const CHALLENGE_SEED: &[u8] = b"aaasChallenge";

#[constant]
pub const CANDIDATE_SEED: &[u8] = b"aaasCandidate";

#[constant]
pub const VALIDATE_SEED: &[u8] = b"aaasValidation";

