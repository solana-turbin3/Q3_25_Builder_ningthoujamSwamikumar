import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenSwapAmm } from "../target/types/token_swap_amm";
import { createAndMintTokens, createValues, ITestValues } from "./utils";
import { expect } from "chai";

describe('create pool', () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const program = anchor.workspace.tokenSwapAmm as Program<TokenSwapAmm>;

    let values: ITestValues;

    before(async () => {
        values = createValues();

        await program.methods.createAmm(values.id, values.fee)
            .accounts({
                admin: values.admin.publicKey,
            }).rpc();
        console.log("✅ amm created");

        const { wallet, connection } = anchor.getProvider();
        await createAndMintTokens(
            wallet.publicKey,
            values.mintA,
            values.mintB,
            wallet.publicKey,
            values.tokenProgram,
            connection,
            wallet.payer
        );
        console.log("✅ tokens created and minted to wallet accounts");
    })

    it("create", async () => {
        await program.methods.createPool()
            .accountsPartial({
                mintA: values.mintA.publicKey,
                mintB: values.mintB.publicKey,
                mintLiquidity: values.mintLiquidity,
                pool: values.pool,
                poolAccountA: values.poolAccountA,
                poolAccountB: values.poolAccountB,
                poolAuthority: values.poolAuthority,
                tokenProgram: values.tokenProgram,
                amm: values.ammKey,
                creator: anchor.getProvider().wallet.publicKey
            })
            .rpc();
    })

    it("invalid mint order", async () => {
        let _mintA = anchor.web3.Keypair.generate();
        let _mintB = anchor.web3.Keypair.generate();
        if (new anchor.BN(_mintA.publicKey.toBytes()).lt(new anchor.BN(_mintB.publicKey.toBytes())))
            [_mintA, _mintB] = [_mintB, _mintA];

        values = createValues({
            mintA: _mintA,
            mintB: _mintB
        });

        await program.methods.createAmm(values.id, values.fee)
            .accounts({
                admin: values.admin.publicKey,
            }).rpc();
        console.log("✅ amm created");

        const { wallet, connection } = anchor.getProvider();
        await createAndMintTokens(
            wallet.publicKey,
            values.mintA,
            values.mintB,
            wallet.publicKey,
            values.tokenProgram,
            connection,
            wallet.payer
        );
        console.log("✅ tokens created and minted to wallet accounts");

        try {
            await program.methods.createPool()
                .accountsPartial({
                    mintA: values.mintA.publicKey,
                    mintB: values.mintB.publicKey,
                    mintLiquidity: values.mintLiquidity,
                    pool: values.pool,
                    poolAccountA: values.poolAccountA,
                    poolAccountB: values.poolAccountB,
                    poolAuthority: values.poolAuthority,
                    tokenProgram: values.tokenProgram,
                    amm: values.ammKey,
                    creator: anchor.getProvider().wallet.publicKey
                })
                .rpc();
            throw new Error("Expected invalid mint order error!");
        } catch (err) {
            expect(err).to.be.instanceOf(anchor.AnchorError);
            if (err instanceof anchor.AnchorError)
                expect(err.error.errorCode.code).to.equal("TokenMintOrderError");
        }
    })

})



