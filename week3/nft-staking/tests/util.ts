import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Signer } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createGenericFile, generateSigner, keypairIdentity, percentAmount, Umi } from "@metaplex-foundation/umi";
import { createNft, findMetadataPda, mplTokenMetadata, verifyCollection, verifyCollectionV1 } from "@metaplex-foundation/mpl-token-metadata";
import { mockStorage } from "@metaplex-foundation/umi-storage-mock";
import path from "path";
import { readFileSync } from "fs";

const program = anchor.workspace.nftStaking as anchor.Program<NftStaking>;

export interface ITestValues {
    admin: web3.Keypair;
    config: web3.PublicKey;
    rewardMint: web3.PublicKey;
    tokenProgram: web3.PublicKey;
    userAccount?: PublicKey;
}

export const CONFIG_SEED = Buffer.from("config");
export const REWARD_MINT_SEED = Buffer.from("reward mint");
export const USER_SEED = Buffer.from("user account");

export const createValues = (defaultValues?: Partial<ITestValues>, user?: PublicKey): ITestValues => {
    const admin = defaultValues.admin ?? web3.Keypair.generate();
    const [config, configBump] = web3.PublicKey.findProgramAddressSync([CONFIG_SEED], program.programId);
    const [rewardMint, rewardMintBump] = web3.PublicKey.findProgramAddressSync([REWARD_MINT_SEED, config.toBuffer()], program.programId);
    const [userAccount, userAccountBump] = user ? PublicKey.findProgramAddressSync([USER_SEED, user.toBuffer()], program.programId) : undefined;
    const tokenProgram = TOKEN_PROGRAM_ID;

    return {
        admin,
        config,
        rewardMint,
        tokenProgram,
        userAccount
    }
}

export type ReturnNfts = {
    collection: PublicKey;
    nft1: PublicKey;
    nft2: PublicKey;
    token: PublicKey;
    umi: Umi;
}

export const createNfts = async (connection: Connection, user: Keypair): Promise<ReturnNfts> => {
    const umi = createUmi(connection);
    const keypair = umi.eddsa.createKeypairFromSecretKey(user.secretKey);
    umi
        .use(keypairIdentity(keypair))
        .use(mplTokenMetadata())
        .use(mockStorage());

    const collectionImagePath = path.join(__dirname, "../images/collection image.png");
    const nft1ImagePath = path.join(__dirname, "../images/nft1.png");
    const nft2ImagePath = path.join(__dirname, "../images/nft2.png");
    const tokenImagePath = path.join(__dirname, "../images/token.png");

    const collectionImageBuffer = readFileSync(collectionImagePath);
    const nft1ImageBuffer = readFileSync(nft1ImagePath);
    const nft2ImageBuffer = readFileSync(nft2ImagePath);
    const tokenImageBuffer = readFileSync(tokenImagePath);

    const collectionImageFile = createGenericFile(collectionImageBuffer, collectionImagePath, { contentType: 'image/png' });
    const nft1ImageFile = createGenericFile(nft1ImageBuffer, nft1ImagePath, { contentType: 'image/png' });
    const nft2ImageFile = createGenericFile(nft2ImageBuffer, nft2ImagePath, { contentType: 'image/png' });
    const tokenImageFile = createGenericFile(tokenImageBuffer, tokenImagePath, { contentType: 'image/png' });

    const [collectionImage, nft1Image, nft2Image, tokenImage] = await umi.uploader.upload([collectionImageFile, nft1ImageFile, nft2ImageFile, tokenImageFile]);
    console.log("images uploaded ✔️");

    const collectionUri = await umi.uploader.uploadJson(
        {
            name: "Noob NFT Collection",
            symbol: "NNFTC",
            description: "This is a nft collection used for testing nft staking program",
            image: collectionImage,
        }
    );
    const nft1Uri = await umi.uploader.uploadJson(
        {
            name: "Noob NFT 1",
            symbol: "NNFT1",
            description: "This is an nft used for testing nft staking program",
            image: nft1Image
        }
    );
    const nft2Uri = await umi.uploader.uploadJson(
        {
            name: "Noob NFT 2",
            symbol: "NNFT2",
            description: "This is an nft used for testing nft staking program",
            image: nft2Image
        }
    );
    const tokenUri = await umi.uploader.uploadJson(
        {
            name: "Noob Token",
            symbol: "NT",
            description: "This is a reward token used in testing nft staking program",
            image: tokenImage
        }
    );
    console.log("metadata uploaded ✔️");

    const collectionMint = generateSigner(umi);
    const nft1Mint = generateSigner(umi);
    const nft2Mint = generateSigner(umi);
    const tokenMint = generateSigner(umi);

    await createNft(umi, {
        mint: collectionMint,
        name: "Noob NFT Collection Mint",
        uri: collectionUri,
        sellerFeeBasisPoints: percentAmount(1),
        updateAuthority: umi.identity.publicKey,
        isCollection: true
    }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" }, send: { commitment: "confirmed" } });
    await createNft(umi, {
        mint: nft1Mint,
        name: "Noob NFT1 Mint",
        uri: nft1Uri,
        symbol: "NNFT1M",
        sellerFeeBasisPoints: percentAmount(1),
        updateAuthority: umi.identity.publicKey,
        collection: {
            key: collectionMint.publicKey,
            verified: false,
        }
    }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" }, send: { commitment: "confirmed" } });
    await createNft(umi, {
        mint: nft2Mint,
        name: "Noob NFT2 Mint",
        symbol: "NNFT2M",
        uri: nft2Uri,
        sellerFeeBasisPoints: percentAmount(1),
        updateAuthority: umi.identity.publicKey,
        collection: {
            key: collectionMint.publicKey,
            verified: false,
        }
    }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" }, send: { commitment: "confirmed" } });
    // await createNft(umi, {
    //     mint: tokenMint,
    //     name: "Noob Token",
    //     uri: tokenUri,
    //     sellerFeeBasisPoints: percentAmount(1),
    // }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" }, send: { commitment: "confirmed" } });
    console.log("nfts minted ✔️");

    const nft1Metadata = findMetadataPda(umi, { mint: nft1Mint.publicKey });
    const nft2Metadata = findMetadataPda(umi, { mint: nft2Mint.publicKey });

    await verifyCollectionV1(umi, {
        collectionMint: collectionMint.publicKey,
        metadata: nft1Metadata,
        authority: umi.identity,
    }).sendAndConfirm(umi);
    await verifyCollectionV1(umi, {
        collectionMint: collectionMint.publicKey,
        metadata: nft2Metadata,
        authority: umi.identity,
    }).sendAndConfirm(umi);
    console.log("verified nfts ✔️");

    return {
        collection: new PublicKey(collectionMint.publicKey),
        nft1: new PublicKey(nft1Mint.publicKey),
        nft2: new PublicKey(nft2Mint.publicKey),
        token: new PublicKey(tokenMint.publicKey),
        umi
    };
}
