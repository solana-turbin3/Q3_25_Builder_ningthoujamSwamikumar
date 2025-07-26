import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenSwapAmm } from "../target/types/token_swap_amm";

import { createValues, ITestValues } from "./utils";
import { expect } from "chai";

describe("create-amm", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.tokenSwapAmm as Program<TokenSwapAmm>;

    let values: ITestValues;

    before(() => {
        values = createValues();
        //console.log("values in beforeEach", values);
    })

    it("create", async () => {
        await program.methods.createAmm(values.id, values.fee)
            .accounts({
                admin: values.admin.publicKey,
                signer: anchor.getProvider().wallet.publicKey,
            })
            .rpc();
        console.log("create amm successful");

        const amm = await program.account.amm.fetch(values.ammKey);
        expect(amm.admin.toBase58()).to.equal(values.admin.publicKey.toBase58());
        expect(amm.fee).to.equal(values.fee);
        expect(amm.id.toBase58()).to.equal(values.id.toBase58());
    })

    it("invalid fee", async () => {
        values.fee = 10000;
        values.id = anchor.web3.PublicKey.unique();
        try {
            await program.methods.createAmm(values.id, values.fee)
                .accounts({
                    admin: values.admin.publicKey
                })
                .rpc();
            throw new Error("expected a revert");
        } catch (err) {
            expect(err).to.be.instanceOf(anchor.AnchorError);
            if (err instanceof anchor.AnchorError)
                expect(err.error.errorCode.code).to.equal("InvalidFee");
        }
    })

})