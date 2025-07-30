import * as anchor from "@coral-xyz/anchor";
import { TokenSwapAmm } from "../target/types/token_swap_amm";
import { createAndMintTokens, createValues, ITestValues } from "./utils";
import { expect } from "chai";

describe.only("withdraw-liquidity", () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const program = anchor.workspace.tokenSwapAmm as anchor.Program<TokenSwapAmm>;
    const { connection, wallet } = program.provider;

    let values: ITestValues;

    beforeEach(async () => {
        values = createValues({}, wallet.payer);

        await program.methods.createAmm(values.id, values.fee)
            .accounts({
                admin: values.admin.publicKey,
                signer: wallet.publicKey,
            }).rpc();
        console.log("✅ created amm");

        await createAndMintTokens(
            wallet.publicKey,
            values.mintA,
            values.mintB,
            wallet.publicKey,
            values.tokenProgram,
            connection,
            wallet.payer
        );
        console.log("✅ created and mint tokens");

        await program.methods.createPool()
            .accounts({
                creator: wallet.publicKey,
                //@ts-expect-error
                amm: values.ammKey,
                mintA: values.mintA.publicKey,
                mintB: values.mintB.publicKey,
                tokenProgram: values.tokenProgram,
            }).rpc();
        console.log("✅ created pool");

        await program.methods.depositLiquidity(new anchor.BN(1000), new anchor.BN(1200))
            .accounts({
                depositor: wallet.publicKey,
                //@ts-expect-error
                pool: values.pool,
                tokenProgram: values.tokenProgram,
            }).rpc();
        console.log("✅ initial deposit of 1000, and 1200");

        await program.methods.depositLiquidity(new anchor.BN(500), new anchor.BN(1200))
            .accounts({
                depositor: wallet.publicKey,
                //@ts-expect-error
                pool: values.pool,
                tokenProgram: values.tokenProgram,
            }).rpc();
        console.log("✅ second deposit tried with 500, and 1200");
    })

    it("withdraw", async () => {
        const poolAccountABalance = (await connection.getTokenAccountBalance(values.poolAccountA)).value.amount;
        const poolAccountBBalance = (await connection.getTokenAccountBalance(values.poolAccountB)).value.amount;
        const userAccountABalance = (await connection.getTokenAccountBalance(values.depositorAccountA)).value.amount;
        const userAccountBBalance = (await connection.getTokenAccountBalance(values.depositorAccountB)).value.amount;
        const liquidityMintSupply = (await connection.getTokenSupply(values.mintLiquidity)).value.amount;
        const userAccountLiquidityBalance = (await connection.getTokenAccountBalance(values.depositorAccountLiquidity)).value.amount;

        await program.methods.withdraw(new anchor.BN(300))
            .accounts({
                tokenProgram: values.tokenProgram,
                user: wallet.publicKey,
                amm: values.ammKey,
                pool: values.pool
            }).rpc();

        const newPoolAccountABalance = (await connection.getTokenAccountBalance(values.poolAccountA)).value.amount;
        const newPoolAccountBBalance = (await connection.getTokenAccountBalance(values.poolAccountB)).value.amount;
        const newUserAccountABalance = (await connection.getTokenAccountBalance(values.depositorAccountA)).value.amount;
        const newUserAccountBBalance = (await connection.getTokenAccountBalance(values.depositorAccountB)).value.amount;
        const newLiquidityMintSupply = (await connection.getTokenSupply(values.mintLiquidity)).value.amount;
        const newUserAccountLiquidityBalance = (await connection.getTokenAccountBalance(values.depositorAccountLiquidity)).value.amount;

        expect(parseInt(newPoolAccountABalance)).to.be.lessThan(parseInt(poolAccountABalance)).to.be.greaterThan(0);
        expect(parseInt(newPoolAccountBBalance)).to.be.lessThan(parseInt(poolAccountBBalance)).to.be.greaterThan(0);
        expect(parseInt(newUserAccountABalance)).to.be.greaterThan(parseInt(userAccountABalance)).to.be.greaterThan(0);
        expect(parseInt(newUserAccountBBalance)).to.be.greaterThan(parseInt(userAccountBBalance)).to.be.greaterThan(0);
        expect(parseInt(newUserAccountLiquidityBalance)).to.be.lessThan(parseInt(userAccountLiquidityBalance)).to.be.greaterThan(0);
        expect(parseInt(newLiquidityMintSupply)).to.be.lessThan(parseInt(liquidityMintSupply)).to.be.greaterThan(0);
    })

    it("insufficient lp balance withdraw", async () => {
        try {
            await program.methods.withdraw(new anchor.BN(2000))
                .accounts({
                    tokenProgram: values.tokenProgram,
                    user: wallet.publicKey,
                    amm: values.ammKey,
                    pool: values.pool
                }).rpc();
            throw new Error("Expected AnchorError: Insufficient Balance!");
        } catch (err) {
            expect(err).to.be.instanceOf(anchor.AnchorError);
            if (err instanceof anchor.AnchorError)
                expect(err.error.errorCode.code).to.be.equal("InsufficientTokenBalance");
        }
    })
})

