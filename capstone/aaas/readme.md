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

### Program Instructions
#### Initialize: 
> Initializes the global [*`config`*](./programs/aaas/src/state/mod.rs#L5-L10), and *`treasury accounts`*
```rust
pub fn initialize(ctx: Context<Initialize>, signers: Vec<Pubkey>, threshold: u8) -> Result<()> {...}
```
> Params:
>- signers: list of signers, upto 5 can be provided.
>- threshold: no. of minimum signers reqd. for *`initialize`* and *`initialize_service`*.
>- [Accounts](./programs/aaas/src/instructions/initialize.rs#L11-L39) : accounts that the instruction reads from write to.

#### Initialize Service:
> Initializes the service which will govern challenges
```rust
pub fn initialize_service(ctx: Context<InitService>, id: Pubkey, fee: u16) -> Result<()> {...}
```
> Params:
>- id: unique id for a service.
>- fee: service fee in basis points.
>- [Accounts](./programs/aaas/src/instructions/initialize_service.rs#L11-L31) : accounts that are being read from and write to.

#### Create Challenge
> creates challenges to achieve a goal, and define necessary standard.
```rust
pub fn create_challenge(
        ctx: Context<CreateChallenge>,
        id: Pubkey,
        start_time: u64,
        end_time: u64,
        stake_amnt: u64,
        proof: String,
        winning_threshold: u16,
    ) -> Result<()> {...}
```
Params:
>- id: unique challenge id
>- start_time: challenge start time after which *`submit_proof`* are allowed.
>- end_time: challenge end time after *`submit_proof`* is not allowed.
>- stake_amnt: stake amount in *`usdc`* to be pool as an accountability token.
>- proof: tiny offchain link where the means of proof to be used is described.
>- winning_threshold: the minimum *`acceptance_rate`* in basis point, to become a winner in the challenge.
>- [Accounts](./programs/aaas/src/instructions/create_challenge.rs#L10-L43) : accounts involved in the instruction as read and write account.

#### Join Challenge
> join the challenge, and create a *`candidate_account`* which will be used to track the candidate throughout the challenge. 
```rust
pub fn join_challenge(ctx: Context<JoinChallenge>) -> Result<()> {...}
```
> Params:
>- [Accounts](./programs/aaas/src/instructions/join_challenge.rs#L11-L53) : accounts that are being involved in the instruction.
>- Can't join a challenge once started.
>- Participant will stake a *`stake_amnt`* to the challenge vault, in USDC. 
>- Participant must have enough USDC in his/her valid token account.
>- Creates a *`candidate_account`* to store candidate informations.

#### Exit Challenge
> exit the challenge if things are not going as expected, before challenge starts.
```rust
pub fn exit_challenge(ctx: Context<ExitChallenge>) -> Result<()> {...}
```
> Params:
>- [Accounts](./programs/aaas/src/instructions/exit_challenge.rs#L12-L54): accounts involved in the instruction.
>- stake amount will be refunded without any deduction, if its called before challene starts.

#### Submit Proof
> Submits a offchain link which leads to the proof in the predefined type and conditions.
```rust
pub fn submit_proof(ctx: Context<SubmitProof>, proof: String) -> Result<()> {...}
```
> Params:
>- proof: tiny offchain link which contains the proof
>- [Accounts](./programs/aaas/src/instructions/submit_proof.rs#L8-L26) : accounts involved in the instruction.
>- proof submission, not allowed after challenge ends.
>- updates the candidate account

#### Validate Proof
> proofs submitted are verified or accepted by other candidates while authenticity of validation, and winners are updated according to the number of validations receive in a candidate account.
```rust
pub fn validate_proof(ctx: Context<ValidateProof>) -> Result<()> {...}
``` 
> Params:
>- [Accounts](./programs/aaas/src/instructions/validate_proof.rs#L12-L54) : accounts that are referenced and modified in the instruction.
>- doesn't allow after 24hrs + challenge end.
>- doesn't allow if the candidate doesn't have (already submitted) proof.
>- acceptance_rate are calculated, and winners are marked once.

#### Withdraw Reward:
> candidates with enough *`acceptance`* to get *`acceptance_rate`* higher than *`winning_threshold`* can claim rewards after the *`validation period`*.
```rust
pub fn withdraw_reward(ctx: Context<WithdrawReward>) -> Result<()> {...}
```
> Params:
>- [Accounts](./programs/aaas/src/instructions/withdraw_reward.rs#L9-L65) : accounts involved in the instruction as modifieable and read only account.
>- Winners are reward thier *`stake_amnt`* + shared losers stake pool.
>- Winners are tax a *`fee`* amount before transferring to thier USDC token account.
>- doesn't allow *`withdraw_reward`* before *`validation period`* ends.

#### Ensure true USDC:
> Ensure USDC in devnet with the build command
```
anchor run build-devnet
```
> Ensure USDC in mainnet with the build command
```
anchor run build-mainnet
```
> By default it allows any token as *`usdc_mint`*
```
anchor build
```

## TODO:
- Create Challenge ✅
- Join Challenge ✅
- Exit Challenge
- Submit Proof ✅
- Validate Proof ✅
- Withdraw Rewards ✅

