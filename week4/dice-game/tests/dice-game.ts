import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { DiceGame } from "../target/types/dice_game";
import { BET_SEED, createValues, ITestValues } from "./utils";
import { expect } from "chai";

describe("dice-game", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.diceGame as Program<DiceGame>;
  const { connection, wallet } = program.provider;

  let testValues: ITestValues;

  before(async () => {
    testValues = await createValues(program);
  })

  it("Is initialized!", async () => {
    const tx = await program.methods.initialize(testValues.houseDeposits)
      .accounts({
        house: wallet.publicKey,
      }).rpc();

    expect((await connection.getBalance(testValues.vault)).toString()).to.be.equal(testValues.houseDeposits.toString(10));
  });

  it("Is bet placed!", async () => {
    await program.methods.placeBet(
      testValues.betAmnt,
      testValues.roll,
      testValues.seed
    ).accounts({
      house: wallet.publicKey,
      player: testValues.player.publicKey,
      //@ts-ignore
      vault: testValues.vault
    }).signers([testValues.player]).rpc({ commitment: "confirmed" });

    expect((await connection.getBalance(testValues.vault)).toString())
      .to.be.equal(testValues.houseDeposits.add(testValues.betAmnt).toString());

    const betAccnt = await program.account.bet.fetch(testValues.betAcc);
    expect(betAccnt.amnt.toString()).to.be.equal(testValues.betAmnt.toString());
    expect(betAccnt.player.toBase58()).to.be.equal(testValues.player.publicKey.toBase58());
    expect(betAccnt.roll).to.be.equal(testValues.roll);
    expect(betAccnt.seed.toString()).to.be.equal(testValues.seed.toString());
  })

  it("Is refunded!", async () => {
    const player = new web3.Keypair();
    const tx = await connection.requestAirdrop(player.publicKey, 100 * web3.LAMPORTS_PER_SOL);
    const recentBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ blockhash: recentBlockhash.blockhash, signature: tx, lastValidBlockHeight: recentBlockhash.lastValidBlockHeight });
    const vaultBal = await connection.getBalance(testValues.vault);

    //place bet
    const betAmnt = new anchor.BN(50 * web3.LAMPORTS_PER_SOL);
    await program.methods.placeBet(
      betAmnt,
      Math.floor(Math.random() * 101),
      new anchor.BN(Math.floor(Math.random() * web3.LAMPORTS_PER_SOL))
    ).accounts({
      house: wallet.publicKey,
      player: player.publicKey,
      //@ts-ignore
      vault: testValues.vault,
    }).signers([player]).rpc();
    const [betAcc, betB] = web3.PublicKey.findProgramAddressSync([BET_SEED, wallet.publicKey.toBuffer(), player.publicKey.toBuffer()], program.programId);
    expect((await connection.getBalance(testValues.vault)).toString(10))
      .to.be.equal(new anchor.BN(vaultBal).add(betAmnt).toString(10));
    expect((await program.account.bet.fetch(betAcc)).amnt.toString()).to.be.equal(betAmnt.toString());
    console.log("placeBet ✔️");

    //refund
    await program.methods.refund()
      .accounts({
        house: wallet.publicKey,
        //@ts-ignore
        vault: testValues.vault,
        bet: betAcc,
        player: player.publicKey
      }).signers([player]).rpc();
    expect(await connection.getBalance(player.publicKey)).to.be.equal(100 * web3.LAMPORTS_PER_SOL);
    expect(await connection.getAccountInfo(betAcc)).to.be.null;
    console.log("refunded ✔️");
  })

  it("is bet resolved!", async () => {
    const betAccnt = connection.getAccountInfo(testValues.betAcc, { commitment: "confirmed" });
    const ix1 = web3.Ed25519Program.createInstructionWithPrivateKey({ message: (await betAccnt).data.subarray(8), privateKey: wallet.payer.secretKey }); //house's secret
    const sig = Array.from(Buffer.from(ix1.data.buffer.slice(16 + 32, 16 + 32 + 64))); //first 16 bytes are sig headers, next 32 bytes is pubkey, and then next 64 bytes is signature
    const ix2 = await program.methods.resolveBet(sig)
      .accounts({
        house: wallet.publicKey,
        //@ts-ignore
        player: testValues.player.publicKey,
        vault: testValues.vault,
        bet: testValues.betAcc
      }).instruction();

    const tx = new web3.Transaction().add(ix1).add(ix2);
    await web3.sendAndConfirmTransaction(connection, tx, [wallet.payer]);

    expect(await connection.getAccountInfo(testValues.betAcc)).to.be.null;
  })
});
