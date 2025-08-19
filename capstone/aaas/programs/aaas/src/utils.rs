use anchor_lang::prelude::*;
use std::str::FromStr;

const USDC_MINT_MAINNET: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; //mainnet usdc

const USDC_MINT_DEVNET: &str = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"; //devnet usdc

pub fn usdc_mint_value() -> Option<Pubkey> {
    #[cfg(feature = "mainnet")]
    {
        return Some(Pubkey::from_str(USDC_MINT_MAINNET).unwrap());
    }
    #[cfg(feature = "devnet")]
    {
        return Some(Pubkey::from_str(USDC_MINT_DEVNET).unwrap());
    }
    #[cfg(feature = "localnet")]
    {
        return None; //no restriction
    }
}
