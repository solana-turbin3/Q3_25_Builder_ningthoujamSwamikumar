use anchor_lang::prelude::*;

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";

#[constant]
pub const REWARD_MINT_SEED: &[u8] = b"reward mint";

#[constant]
pub const USER_SEED: &[u8] = b"user account";

#[constant]
pub const STAKE_SEED: &[u8] = b"stake account";

#[constant]
pub const YEAR_IN_SECS: i64 = 31_536_000i64;
