import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { createNfts, createValues, ITestValues, ReturnNfts } from "./util";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { fetchDigitalAsset, fetchMetadata, findMetadataPda } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";
import { expect } from "chai";
import * as fs from "fs";

describe("stake nft", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.nftStaking as Program<NftStaking>;
  const { connection, wallet } = program.provider;

  let values: ITestValues;
  let nftValues: ReturnNfts;

  beforeEach(async () => {
    nftValues = await createNfts(connection, wallet.payer);
    values = await createValues({}, wallet.publicKey, nftValues);

    //airdrop the admin
    const recentBlockhash = await connection.getLatestBlockhash("confirmed");
    const airdropTx = await connection.requestAirdrop(values.admin.publicKey, 100 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction({ blockhash: recentBlockhash.blockhash, lastValidBlockHeight: recentBlockhash.lastValidBlockHeight, signature: airdropTx }, "confirmed");

    await program.methods.initializeConfig(120, 3, 60 * 60 * 24 * 30 * 6)
      .accounts({
        admin: values.admin.publicKey,
        tokenProgram: values.tokenProgram
      }).signers([values.admin]).rpc({ commitment: "confirmed" });
    console.log("initialized config ✔️");

    await program.methods.initializeUser()
      .accounts({
        user: wallet.publicKey
      }).rpc({ commitment: "confirmed" });
    console.log("initialized user ✔️");
  })

  it("stake nft1", async () => {
    //console.log("values:", values);
    const userAccountData = await program.account.userAccount.fetch(values.userAccount, "confirmed");
    //console.log("userAccountData:", userAccountData);

    const userAccountInfo = await connection.getAccountInfo(values.userAccount, "confirmed");
    //console.log("userAccountInfo:", userAccountInfo);
    expect(userAccountInfo).to.be.not.null;

    await program.methods.stakeNft()
      .accounts({
        mint: nftValues.nft1,
        tokenProgram: values.tokenProgram,
        user: wallet.publicKey,
        userAccount: values.userAccount,
      }).rpc({ commitment: "confirmed" });
    console.log("✅ NFT staked");

    const metadataPda = findMetadataPda(nftValues.umi, { mint: publicKey(nftValues.nft1.toString()) });
    //console.log("metadataPda:", metadataPda);
    const metadata = await fetchMetadata(nftValues.umi, metadataPda);
    //console.log("nft1 metadata:", metadata);

    const onchainAsset = await fetchDigitalAsset(nftValues.umi, publicKey(nftValues.nft1));
    //console.log("onchainAsset:", onchainAsset);

    //Since, we are using mockstorage, direct fetching won't work
    const downloadedImagePath = "tests/nft1-image.png";
    fs.unlinkSync(downloadedImagePath); //remove already existed file
    expect(fs.existsSync(downloadedImagePath)).to.be.false;
    console.log("Expectation✅-image path doesn't exist");
    const offchainData = await nftValues.umi.downloader.downloadJson(metadata.uri);
    const imageBuffer = await nftValues.umi.downloader.download([offchainData.image]);
    fs.writeFileSync(downloadedImagePath, Buffer.from(imageBuffer[0].buffer));
    expect(fs.existsSync(downloadedImagePath)).to.be.true;
    console.log("Expectation✅ downloaded image path exist");

    expect(metadata.collection.__option).to.be.equal("Some");
    console.log("Expectation✅ metadata collection has value 'Some'");
    if (metadata.collection.__option === "Some") {
      expect(metadata.collection?.value.key).to.be.equal(publicKey(nftValues.collection));
      expect(metadata.collection?.value.verified).to.be.true;
      console.log("Expectation✅ metadata.collection equals nftValues.collection, and metadata.collection.verified is true");
    }

    const newUserAccountData = await program.account.userAccount.fetch(values.userAccount, "confirmed");
    console.log("newUserAccountData:", newUserAccountData);
    expect(newUserAccountData.amountStaked).to.be.greaterThan(0);
    expect(newUserAccountData.points).to.be.equal(0);
    console.log("Expectation✅ newUserAccountData.amountStaked > 0 and newuserAccountData.points equals 0");
  })
});
