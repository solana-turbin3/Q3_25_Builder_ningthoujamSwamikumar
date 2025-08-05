import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
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
    stakeAccounts: PublicKey[];
    userAtas: PublicKey[];
    vaults: PublicKey[];
    points_per_stake: number;
    freeze_period: number;
    max_unstake: number;
}

export const CONFIG_SEED = Buffer.from("config");
export const REWARD_MINT_SEED = Buffer.from("reward mint");
export const USER_SEED = Buffer.from("user account");

/**
 * generates accounts that are needed to test the program
 * @param defaultValues optional and not utilized much
 * @param user needed at initialize_user instruction and beyond
 * @param nftValues needed at stake instruction and beyond
 * @returns 
 */
export const createValues = async (defaultValues?: Partial<ITestValues>, user?: PublicKey, nftValues?: ReturnNfts): Promise<ITestValues> => {
    const admin = defaultValues.admin ?? web3.Keypair.generate();
    const [config, configBump] = web3.PublicKey.findProgramAddressSync([CONFIG_SEED], program.programId);
    const [rewardMint, rewardMintBump] = web3.PublicKey.findProgramAddressSync([REWARD_MINT_SEED, config.toBuffer()], program.programId);
    const [userAccount, userAccountBump] = user ? PublicKey.findProgramAddressSync([USER_SEED, user.toBuffer()], program.programId) : undefined;
    const tokenProgram = TOKEN_PROGRAM_ID;

    const stakeAccount1Pda = user && nftValues ? PublicKey.findProgramAddressSync([Buffer.from("stake account"), user.toBuffer(), nftValues.nft1.toBuffer()], program.programId) : undefined;
    const stakeAccount2Pda = user && nftValues ? PublicKey.findProgramAddressSync([Buffer.from("stake account"), user.toBuffer(), nftValues.nft2.toBuffer()], program.programId) : undefined;

    const userAta1 = user && nftValues ? await getAssociatedTokenAddress(nftValues.nft1, user) : undefined;
    const userAta2 = user && nftValues ? await getAssociatedTokenAddress(nftValues.nft2, user) : undefined;

    const vault1 = user && nftValues ? await getAssociatedTokenAddress(nftValues.nft1, stakeAccount1Pda[0], true) : undefined;
    const vault2 = user && nftValues ? await getAssociatedTokenAddress(nftValues.nft2, stakeAccount2Pda[0], true) : undefined;

    return {
        admin,
        config,
        rewardMint,
        tokenProgram,
        userAccount,
        stakeAccounts: user && nftValues ? [stakeAccount1Pda[0], stakeAccount2Pda[0]] : [],
        userAtas: user && nftValues ? [userAta1, userAta2] : [],
        vaults: user && nftValues ? [vault1, vault2] : [],
        freeze_period: 10, //10 seconds for testing
        max_unstake: 3,
        points_per_stake: 120,
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

export const waitForFreezePeriod = async (provider: anchor.Provider, admin: Keypair, seconds: number) => {
    const start = await provider.connection.getBlockTime(await provider.connection.getSlot());

    while (true) {
        // Send a dummy tx to force block production
        const tx = new anchor.web3.Transaction().add(
            anchor.web3.SystemProgram.transfer({
                fromPubkey: admin.publicKey,
                toPubkey: admin.publicKey,
                lamports: 0,
            })
        );
        await provider.sendAndConfirm(tx, [admin]);

        const current = await provider.connection.getBlockTime(await provider.connection.getSlot());
        const timePassed = current - start;
        if (timePassed > seconds) break;
        console.log("⌚time passed:", timePassed);

        await new Promise((r) => setTimeout(r, 500)); // small buffer
    }
};
