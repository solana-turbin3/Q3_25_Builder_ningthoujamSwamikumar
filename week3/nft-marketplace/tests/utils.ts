import { Program, web3 } from "@coral-xyz/anchor";
import { NftMarketplace } from "../target/types/nft_marketplace";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, keypairIdentity, lamports, percentAmount, publicKey } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair, fromWeb3JsPublicKey, toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { mockStorage } from "@metaplex-foundation/umi-storage-mock";
import { createNft, fetchMetadata, findMasterEditionPda, findMetadataPda, mplTokenMetadata, verifyCollection, verifyCollectionV1 } from "@metaplex-foundation/mpl-token-metadata";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";


const MARKETPLACE_SEED = "market";
const TREASURY_SEED = "treasury";
const LISTING_ACCOUNT_SEED = "listing account";

export type INft = {
    mint: web3.PublicKey,
    collection: web3.PublicKey,
    metadata: web3.PublicKey,
    masterEdition: web3.PublicKey,
}

export type ITestValues = {
    admin: web3.Keypair,
    marketplace: web3.PublicKey,
    vault: web3.PublicKey,
    listingAccount: web3.PublicKey,
    buyer: web3.Keypair,
    buyerAta: web3.PublicKey,
    treasury: web3.PublicKey,
    //
    buyerListingAccount: web3.PublicKey,
    buyerVault: web3.PublicKey,
}

export const createValues = async (program: Program<NftMarketplace>, nfts: INft): Promise<ITestValues> => {
    const { connection } = program.provider;

    const [marketplace, _] = web3.PublicKey.findProgramAddressSync([Buffer.from(MARKETPLACE_SEED)], program.programId);

    const admin = web3.Keypair.generate();
    const buyer = web3.Keypair.generate();
    const treasury = web3.PublicKey.findProgramAddressSync([Buffer.from(TREASURY_SEED), marketplace.toBuffer()], program.programId);

    const recentBlockhash = await connection.getLatestBlockhash();
    const airDropTx = await connection.requestAirdrop(admin.publicKey, 10 * web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction({ blockhash: recentBlockhash.blockhash, lastValidBlockHeight: recentBlockhash.lastValidBlockHeight, signature: airDropTx });

    const airDropBuyerTx = await connection.requestAirdrop(buyer.publicKey, 10 * web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction({ blockhash: recentBlockhash.blockhash, lastValidBlockHeight: recentBlockhash.lastValidBlockHeight, signature: airDropBuyerTx });

    const airdropTreasury = await connection.requestAirdrop(treasury[0], 10 * web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction({ blockhash: recentBlockhash.blockhash, lastValidBlockHeight: recentBlockhash.lastValidBlockHeight, signature: airdropTreasury });


    const listingAccount = web3.PublicKey.findProgramAddressSync([
        Buffer.from(LISTING_ACCOUNT_SEED),
        marketplace.toBuffer(),
        program.provider.wallet.publicKey.toBuffer(),
        nfts.mint.toBuffer()
    ], program.programId);
    const vault = getAssociatedTokenAddressSync(nfts.mint, listingAccount[0], true);

    const buyerAta = getAssociatedTokenAddressSync(nfts.mint, buyer.publicKey, false);

    const buyerListingAccount = web3.PublicKey.findProgramAddressSync([
        Buffer.from(LISTING_ACCOUNT_SEED),
        marketplace.toBuffer(),
        buyer.publicKey.toBuffer(),
        nfts.mint.toBuffer()
    ], program.programId);
    const buyerVault = getAssociatedTokenAddressSync(nfts.mint, buyerListingAccount[0], true);

    return {
        admin,
        marketplace,
        listingAccount: listingAccount[0],
        vault,
        buyer,
        buyerAta,
        treasury: treasury[0],
        //
        buyerListingAccount: buyerListingAccount[0],
        buyerVault
    }
}

export const createNfts = async (program: Program<NftMarketplace>): Promise<INft> => {
    //create umi
    const umi = createUmi(program.provider.connection);
    const authority = generateSigner(umi);

    const recentBlockhash = await program.provider.connection.getLatestBlockhash();
    const airDropTx = await program.provider.connection.requestAirdrop(toWeb3JsPublicKey(authority.publicKey), 10 * web3.LAMPORTS_PER_SOL);
    await program.provider.connection.confirmTransaction({ blockhash: recentBlockhash.blockhash, lastValidBlockHeight: recentBlockhash.lastValidBlockHeight, signature: airDropTx });
    console.log("airdropped umi user✔️");

    umi.use(keypairIdentity(authority, true));
    umi.use(mockStorage());
    umi.use(mplTokenMetadata());


    //create collection
    const collectionOffchain = await umi.uploader.uploadJson(
        {
            name: "Marketplace Collection",
            image: "dummy image uri",
        }
    );
    const collectionMint = generateSigner(umi);
    await createNft(umi, {
        mint: collectionMint,
        name: "Marketplace Collection",
        uri: collectionOffchain,
        sellerFeeBasisPoints: percentAmount(0),
        isCollection: true,
    }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
    console.log("Collection NFT created ✔️");

    //create nft
    const nftMint = generateSigner(umi);
    const nftOffchain = await umi.uploader.uploadJson({
        name: "Marketplace NFT offchain",
        description: "This is nft offchain data",
    })
    await createNft(umi, {
        mint: nftMint,
        name: "Marketplace NFT",
        sellerFeeBasisPoints: percentAmount(0.1),
        uri: nftOffchain,
        collection: {
            key: publicKey(collectionMint.publicKey.toString()),
            verified: false
        },
        tokenOwner: fromWeb3JsPublicKey(program.provider.wallet.publicKey),

    }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
    console.log("Marketplace NFT created, and minted ✔️");


    const metadataPda = findMetadataPda(umi, { mint: nftMint.publicKey });
    const masterEdition = findMasterEditionPda(umi, { mint: nftMint.publicKey });

    //verify nft
    verifyCollectionV1(umi, { collectionMint: collectionMint.publicKey, metadata: metadataPda }).sendAndConfirm(umi);
    console.log("verify collection ✔️");

    const metadata = await fetchMetadata(umi, metadataPda);
    //console.log("metadata: ", metadata);

    return {
        collection: toWeb3JsPublicKey(collectionMint.publicKey),
        mint: toWeb3JsPublicKey(nftMint.publicKey),
        metadata: toWeb3JsPublicKey(metadataPda[0]),
        masterEdition: toWeb3JsPublicKey(masterEdition[0]),
    }
}
