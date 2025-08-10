import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftMarketplace } from "../target/types/nft_marketplace";
import { createNfts, createValues, INft, ITestValues } from "./utils";
import { expect } from "chai";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

describe("nft-marketplace test", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.nftMarketplace as Program<NftMarketplace>;
  const { wallet, connection } = program.provider;

  let values: ITestValues;
  let nfts: INft;

  before(async () => {
    nfts = await createNfts(program);
    values = await createValues(program, nfts);
  })

  it("Is initialized!", async () => {
    // Add your test here.
    await program.methods.initialize(1000)
      .accounts({
        admin: values.admin.publicKey,
      }).signers([values.admin]).rpc();
    console.log("Marketplace initialized ✔️");

    //assertions and expectatations
    const marketplaceAccounts = await program.account.marketplace.all();
    expect(marketplaceAccounts.length).to.be.equal(1);
    console.log("Expectation✅ - marketplace.length is 1");
    expect(marketplaceAccounts[0].account.admin.toBase58()).to.be.equal(values.admin.publicKey.toBase58());
    console.log("Expectation✅ - marketplace admin is values.admin");
    expect(marketplaceAccounts[0].account.fee).to.be.greaterThan(0);
    console.log("Expectation✅ - marketplace fee is positive");
  });

  it("Is Listed!", async () => {
    await program.methods.listing(20000)
      .accounts({
        collectionMint: nfts.collection,
        listingMint: nfts.mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: wallet.publicKey,
        marketplace: values.marketplace
      }).rpc();

    const vaultBalance = (await connection.getTokenAccountBalance(values.vault)).value.amount;
    expect(parseInt(vaultBalance)).to.be.equal(1);
    console.log("Expectation✅ - vault balance is 1");

    const listingAccountData = await program.account.listingAccount.fetch(values.listingAccount);
    expect(listingAccountData.price).to.be.equal(20000);
    console.log("Expectation✅ - listingAccount has price 20000");
  })

  it("Is purchased!", async () => {
    const treasuryBal = await connection.getBalance(values.treasury);
    const sellerBal = await connection.getBalance(wallet.publicKey);

    const tx = await program.methods.purchase()
      .accounts({
        buyer: values.buyer.publicKey,
        seller: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        listingAccount: values.listingAccount,
        mint: nfts.mint,
        marketplace: values.marketplace,
        treasury: values.treasury,
      }).signers([values.buyer]).rpc();
    console.log("Nft Purchased ✔️");

    const newTreasuryBal = await connection.getBalance(values.treasury);
    const newSellerBal = await connection.getBalance(wallet.publicKey);
    const buyerAtaBalance = (await connection.getTokenAccountBalance(values.buyerAta)).value.amount;
    const vaultAccount = await connection.getAccountInfo(values.vault);

    expect(newTreasuryBal).to.be.greaterThan(treasuryBal);
    expect(newSellerBal).to.be.greaterThan(sellerBal);
    console.log("Expectation✅ - newTreasuryBal and newSellerBalan are increased");
    expect(parseInt(buyerAtaBalance)).to.be.equal(1);
    console.log("Expectation✅ - buyer ata balance is 1");
    expect(vaultAccount).to.be.null;
    console.log("Expectation✅ - Vault account is null");
  })

  it("Is delisted!", async () => {
    const buyerBalance = await connection.getBalance(values.buyer.publicKey, "confirmed");
    console.log("buyerBalance:", buyerBalance);
    //list
    await program.methods.listing(30000)
      .accounts({
        collectionMint: nfts.collection,
        listingMint: nfts.mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: values.buyer.publicKey,
        marketplace: values.marketplace
      }).signers([values.buyer]).rpc({ commitment: "confirmed" });
    console.log("buyer has listed the nft ✔️");

    console.log("buyerBalance after listing:", await connection.getBalance(values.buyer.publicKey, "confirmed"));

    const buyerAtaBalance = (await connection.getTokenAccountBalance(values.buyerAta)).value.amount;
    expect(parseInt(buyerAtaBalance)).to.be.equal(0);
    console.log("Expectation✅ - Buyer nft has been listed");

    //delist
    await program.methods.delisting()
      .accounts({
        user: values.buyer.publicKey,
        mint: nfts.mint,
        listingAccount: values.buyerListingAccount,
        marketplace: values.marketplace,
      }).signers([values.buyer]).rpc({ commitment: "confirmed" });
    console.log("buyer has unlisted the nft ✔️");

    //expectations
    const newBuyerAtaBalance = (await connection.getTokenAccountBalance(values.buyerAta)).value.amount;
    expect(parseInt(newBuyerAtaBalance)).to.be.equal(1);
    console.log("Expectation✅ - Buyer has unlisted the nft");

    const buyerVaultAccount = await connection.getAccountInfo(values.buyerVault);
    const buyerListingAccount = await connection.getAccountInfo(values.buyerListingAccount);
    expect(buyerVaultAccount).to.be.null;
    expect(buyerListingAccount).to.be.null;
    console.log("Expectation✅ - buyerVault and buyerListingAccount are null");

    const newBuyerBalance = await connection.getBalance(values.buyer.publicKey, "confirmed");
    console.log("buyerBalance after delisting:", newBuyerBalance);
    expect(newBuyerBalance).to.not.equal(buyerBalance);
    console.log("Expectation✅ - buyer SOL balance has been changed due to tx fees deduction");
  })

});
