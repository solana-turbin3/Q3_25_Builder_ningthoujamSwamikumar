import * as anchor from "@coral-xyz/anchor";
import { TokenSwapAmm } from "../target/types/token_swap_amm";
import { createAndMintTokens, createValues, ITestValues } from "./utils";
import { expect } from "chai";

describe.only("swap-token-for-token", () => {
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
                amm: values.ammKey,
                mintA: values.mintA.publicKey,
                mintB: values.mintB.publicKey,
                tokenProgram: values.tokenProgram,
            }).rpc();
        console.log("✅ created pool");

        await program.methods.depositLiquidity(new anchor.BN(1000), new anchor.BN(1200))
            .accounts({
                depositor: wallet.publicKey,
                pool: values.pool,
                tokenProgram: values.tokenProgram,
            }).rpc();
        console.log("✅ initial deposit of 1000, and 1200");

        await program.methods.depositLiquidity(new anchor.BN(500), new anchor.BN(1200))
            .accounts({
                depositor: wallet.publicKey,
                pool: values.pool,
                tokenProgram: values.tokenProgram,
            }).rpc();
        console.log("✅ second deposit tried with 500, and 1200");
    })

    it("swap a for b", async () => {
        const tokenBalanceA = (await connection.getTokenAccountBalance(values.depositorAccountA)).value.amount;
        const tokenBalanceB = (await connection.getTokenAccountBalance(values.depositorAccountB)).value.amount;
        console.log("")
        await program.methods.swapToken(true, new anchor.BN(150), new anchor.BN(100))
            .accounts({
                user: wallet.publicKey,
                amm: values.ammKey,
                mintA: values.mintA.publicKey,
                mintB: values.mintB.publicKey,
                tokenProgram: values.tokenProgram,
            }).rpc();
        const newTokenBalanceA = (await connection.getTokenAccountBalance(values.depositorAccountA)).value.amount;
        const newTokenBalanceB = (await connection.getTokenAccountBalance(values.depositorAccountB)).value.amount;
        expect(parseInt(newTokenBalanceA)).to.be.lessThan(parseInt(tokenBalanceA));
        expect(parseInt(tokenBalanceA)).to.be.equal(parseInt(newTokenBalanceA) + 150);

        expect(parseInt(newTokenBalanceB)).to.be.greaterThan(parseInt(tokenBalanceB));
        expect(parseInt(newTokenBalanceB)).to.be.greaterThan(parseInt(tokenBalanceB) + 100);
    })

    it("swap b for a", async () => {
        const tokenBalanceA = (await connection.getTokenAccountBalance(values.depositorAccountA)).value.amount;
        const tokenBalanceB = (await connection.getTokenAccountBalance(values.depositorAccountB)).value.amount;
        console.log("")
        await program.methods.swapToken(false, new anchor.BN(150), new anchor.BN(100))
            .accounts({
                user: wallet.publicKey,
                amm: values.ammKey,
                mintA: values.mintA.publicKey,
                mintB: values.mintB.publicKey,
                tokenProgram: values.tokenProgram,
            }).rpc();
        const newTokenBalanceA = (await connection.getTokenAccountBalance(values.depositorAccountA)).value.amount;
        const newTokenBalanceB = (await connection.getTokenAccountBalance(values.depositorAccountB)).value.amount;
        expect(parseInt(newTokenBalanceA)).to.be.greaterThan(parseInt(tokenBalanceA));
        expect(parseInt(newTokenBalanceA)).to.be.greaterThan(parseInt(tokenBalanceA) + 100);

        expect(parseInt(newTokenBalanceB)).to.be.lessThan(parseInt(tokenBalanceB));
        expect(parseInt(newTokenBalanceB)).to.be.lessThanOrEqual(parseInt(tokenBalanceB) - 150);
    })

    it("output too small swap", async () => {
        try {
            await program.methods.swapToken(true, new anchor.BN(150), new anchor.BN(150))
                .accounts({
                    user: wallet.publicKey,
                    amm: values.ammKey,
                    mintA: values.mintA.publicKey,
                    mintB: values.mintB.publicKey,
                    tokenProgram: values.tokenProgram,
                }).rpc();
            throw new Error("Expected Anchor Error!");
        } catch (err) {
            expect(err).to.be.instanceOf(anchor.AnchorError);
            if (err instanceof anchor.AnchorError)
                expect(err.error.errorCode.code).to.be.equal("OuputTooSmall");
        }
    })

    it("insufficient balance swap", async () => {
        try {
            await program.methods.swapToken(true, new anchor.BN(20000000), new anchor.BN(150))
                .accounts({
                    user: wallet.publicKey,
                    amm: values.ammKey,
                    mintA: values.mintA.publicKey,
                    mintB: values.mintB.publicKey,
                    tokenProgram: values.tokenProgram,
                }).rpc();
            throw new Error("Expected Anchor Error!");
        } catch (err) {
            expect(err).to.be.instanceOf(anchor.AnchorError);
            if (err instanceof anchor.AnchorError)
                expect(err.error.errorCode.code).to.be.equal("InsufficientTokenBalance");
        }
    })
})
