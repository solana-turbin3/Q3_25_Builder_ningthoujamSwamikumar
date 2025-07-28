import * as anchor from "@coral-xyz/anchor";
import { TokenSwapAmm } from "../target/types/token_swap_amm";
import { createAndMintTokens, createValues, ITestValues, MINT_A_DECIMALS } from "./utils";
import { assert, expect } from "chai";
import { getAssociatedTokenAddress, getAssociatedTokenAddressSync } from "@solana/spl-token";

describe("deposit-liquidity", () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const program = anchor.workspace.tokenSwapAmm as anchor.Program<TokenSwapAmm>;
    const { connection, wallet } = anchor.getProvider();

    let values: ITestValues;

    before(async () => {
        values = createValues({}, wallet.payer);

        const mintANumber = new anchor.BN(values.mintA.publicKey.toBytes());
        const mintBNumber = new anchor.BN(values.mintB.publicKey.toBytes());
        if (mintANumber.gt(mintBNumber)) {
            console.log("❌ mint A is gt mint B");
        } else {
            console.log("✅ token mints are in order");
        }

        await program.methods.createAmm(values.id, values.fee)
            .accounts({
                admin: values.admin.publicKey,
                signer: wallet.publicKey
            }).rpc();
        console.log("✅ create amm");

        await createAndMintTokens(
            wallet.publicKey,
            values.mintA,
            values.mintB,
            wallet.publicKey,
            values.tokenProgram,
            connection,
            wallet.payer
        );
        console.log("✅ created and minted tokens to depositor accounts");

        await program.methods.createPool()
            .accounts({
                creator: wallet.publicKey,
                amm: values.ammKey,
                mintA: values.mintA.publicKey,
                mintB: values.mintB.publicKey,
                tokenProgram: values.tokenProgram,
            }).rpc();
        console.log("✅ create pool");
    })

    it("deposit", async () => {
        await program.methods.depositLiquidity(new anchor.BN(200), new anchor.BN(100))
            .accounts({
                depositor: wallet.publicKey,
                mintA: values.mintA,
                mintB: values.mintB,
                pool: values.pool,
                tokenProgram: values.tokenProgram,
            }).rpc();

        const poolAccountABalance = BigInt((await connection.getTokenAccountBalance(values.poolAccountA)).value.amount);
        console.log("poolA balance", (await connection.getParsedAccountInfo(values.poolAccountA)).value.data.parsed.info.tokenAmount);
        assert(poolAccountABalance > BigInt(180), "Expected poolAccountABalance to be gt 180");

        const poolAccountBBalance = BigInt((await connection.getTokenAccountBalance(values.poolAccountB)).value.amount);
        console.log("poolB balance", (await connection.getParsedAccountInfo(values.poolAccountB)).value.data.parsed.info.tokenAmount);
        assert(poolAccountBBalance > BigInt(80), "Expected poolAccountBBalance to be gt 80");

        const liquidityAta = await getAssociatedTokenAddress(values.mintLiquidity, wallet.publicKey, false, values.tokenProgram);
        const liquiditySupply = BigInt((await connection.getTokenSupply(values.mintLiquidity)).value.amount);
        const ataLiquidityBalance = BigInt((await connection.getTokenAccountBalance(liquidityAta)).value.amount);
        expect(liquiditySupply).to.equal(ataLiquidityBalance);

        const ataA = getAssociatedTokenAddressSync(values.mintA.publicKey, wallet.publicKey, false, values.tokenProgram);
        const ataABalance = BigInt((await connection.getTokenAccountBalance(ataA)).value.amount);
        console.log("ata balance", (await connection.getParsedAccountInfo(ataA)).value.data.parsed.info.tokenAmount);
        expect(ataABalance).to.equal(BigInt(1000 * Math.pow(10, MINT_A_DECIMALS)) - BigInt(200));
    })
})

