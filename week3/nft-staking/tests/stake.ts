import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { createNfts, createValues, ITestValues, ReturnNfts } from "./util";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { fetchDigitalAsset, fetchMetadata, findMetadataPda } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";
import { expect } from "chai";
import * as fs from "fs";

describe.only("stake nft", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.nftStaking as Program<NftStaking>;
  const { connection, wallet } = program.provider;

  let values: ITestValues;
  let nftValues: ReturnNfts;

  beforeEach(async () => {
    values = createValues({}, wallet.publicKey);
    nftValues = await createNfts(connection, wallet.payer);

    //airdrop the admin
    const recentBlockhash = await connection.getLatestBlockhash("confirmed");
    const airdropTx = await connection.requestAirdrop(values.admin.publicKey, 100 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction({ blockhash: recentBlockhash.blockhash, lastValidBlockHeight: recentBlockhash.lastValidBlockHeight, signature: airdropTx }, "confirmed");

    await program.methods.initializeConfig(120, 3, 60 * 60 * 24 * 30 * 6)
      .accounts({
        admin: values.admin.publicKey,
        tokenProgram: values.tokenProgram
      }).signers([values.admin]).rpc();
    console.log("✅ initialized config");

    await program.methods.initializeUser()
      .accounts({
        user: wallet.publicKey
      }).rpc();
    console.log("✅ initialized user");
  })

  it("stake nft1", async () => {
    await program.methods.stakeNft()
      .accounts({
        mint: nftValues.nft1,
        tokenProgram: values.tokenProgram,
        user: wallet.publicKey,
      }).rpc();
    const metadataPda = findMetadataPda(nftValues.umi, { mint: publicKey(nftValues.nft1.toString()) });
    console.log("metadataPda:", metadataPda);
    const metadata = await fetchMetadata(nftValues.umi, metadataPda);
    console.log("nft1 metadata:", metadata);
    const onchainAsset = await fetchDigitalAsset(nftValues.umi, publicKey(nftValues.nft1));
    console.log("onchainAsset:", onchainAsset);
    nftValues.umi.downloader.downloadJson(metadata.uri)
      .then(res => {
        console.log("downloader res:", res);
        return res.image;
      })
      .then(image => nftValues.umi.downloader.download([image]))
      .then(imageBuffer => fs.writeFileSync("nft1-image.png", Buffer.from(imageBuffer[0].buffer)))
      .catch(err => console.log("downloader err:", err));
    //this is expected to fail, as we are using mockstorage, direct fetching doesn't work
    fetch(metadata.uri)
      .then(res => console.log("offchain metadata:", res))
      .catch(err => console.log("error fetching offchain data:", err));

    expect(metadata.collection.__option).to.be.equal("Some");
    if (metadata.collection.__option === "Some") {
      expect(metadata.collection?.value.key).to.be.equal(publicKey(nftValues.collection));
      expect(metadata.collection?.value.verified).to.be.true;
    }
  })
});
