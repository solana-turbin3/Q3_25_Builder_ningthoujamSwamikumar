import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";

const LAMPORTS_PER_SOL = 1_000_000_000n;

describe("vault", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.vault as Program<Vault>;
  const { wallet, connection } = anchor.getProvider();

  let vault_state_key;
  let vault_key;

  before(async () => {
    const [stateKey, _stateBump] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('state'), wallet.publicKey.toBuffer()], program.programId);
    vault_state_key = stateKey;

    const [vaultKey, _vaultBump] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('vault'), stateKey.toBuffer()], program.programId);
    vault_key = vaultKey;
  });


  it("Is initialized!", async () => {
    console.log("wallet balance before initialization", await connection.getBalance(wallet.publicKey));

    const vaultAccountBefore = await connection.getAccountInfo(vault_key);
    console.log("vault account before tx");
    console.log(vaultAccountBefore);

    await program.methods.initialize().signers([wallet.payer]).rpc();
    console.log("Initialization successful.");

    const vaultAccountAfter = await connection.getAccountInfo(vault_key);
    console.log("vault:");
    console.log(vaultAccountAfter);

    console.log("wallet balance after initialization", await connection.getBalance(wallet.publicKey));
  });

  it("deposits", async () => {
    console.log("wallet balance before deposit", await connection.getBalance(wallet.publicKey));

    console.log("vault account before deposit:", await connection.getAccountInfo(vault_key));

    await program.methods.deposit(new anchor.BN(10n * LAMPORTS_PER_SOL)).rpc();
    console.log("deposit successfull");

    console.log("vault account after deposit:", await connection.getAccountInfo(vault_key));
  });

  it("withdraws", async () => {
    console.log("wallet balance before withdraw", await connection.getBalance(wallet.publicKey));

    console.log("vault account before withdraw:", await connection.getAccountInfo(vault_key));

    await program.methods.withdraw(new anchor.BN(5n * LAMPORTS_PER_SOL)).rpc();
    console.log("withdraw successfull");

    console.log("vault account after withdraw:", await connection.getAccountInfo(vault_key));
  });
});
