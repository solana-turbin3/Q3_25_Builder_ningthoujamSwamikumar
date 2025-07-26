use anchor_lang::prelude::*;

#[constant]
pub const SEED: &str = "anchor";

#[constant]
pub const LIQUIDITY_SEED: &[u8] = b"liquidity";

#[constant]
pub const AUTHORITY_SEED: &[u8] = b"authority";

#[constant]
pub const MINIMUM_LIQUIDITY: u64 = 100;
