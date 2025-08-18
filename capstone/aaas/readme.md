# AAAS (Accountability as a Service)
### A trustless platform that turns goal achievement into a social, verifiable, and financially incentivized experience. 
This Capstone Project is built as a part of [Q3 Builder's Cohort](https://github.com/solana-turbin3/Q3_25_Builder_ningthoujamSwamikumar) by [Turbine3](https://turbin3.org/). Its deployed at [Devnet](https://explorer.solana.com/address/3SjXbrVTBAxCpLT9fdYuSaMJnpHa1fxx7ncBFvoQsnrE?cluster=devnet)

> Users stake money to join flexible, peer-led challenges with manual peer validation. Winners get their money back + losers money pool distributed among the winners. 

### Program Design
- Config : a global account that defines the *`signers`* (authorities), *`threshold`* (the minimum no. of signers reqd. for critical function), the *`admin`* (account that owns *`treasury`*).
- Treasury: a global token account, used to collect fee.
- Service : defines an accountability service, and its fee. Need threshold multi-sig to create this. Every *`challenge`* is govern by a service.
- Challenge: defines everything that reqd in a challenge like *`start_time`*, *`end_time`*, *`stake_amnt`*, *`proof`*, etc., and its the main component of the program. Can be created by anyone. Everything that follows this component will be associated to a challenge.
- Vault: a token account, used to store the stake pool of a challenge in USDC. This is created when a challenge is created.
- Candidate Account: this defines the info of a specific candidate participated in a challenge by staking a stake amount in USDC. This is created by the program when a participant joins a challenge.
- Validation: a PDA as a proof of validation (voting). This associates a candidate (validator) with another candidate for whom he/she is validating the proof.

### Implementation
- Initialize
[code link test](./programs/aaas/src/lib.rs)
- Create Challenge
- Join Challenge ✅
- Exit Challenge
- Submit Proof ✅
- Validate Proof ✅
- Withdraw Rewards ✅


