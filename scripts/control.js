// scripts/control.js
//
// 🕹️ Interactive CLI for MEVBotExecutor
//
// Features:
//  - Status dashboard (owner, init, providers, profit token, slippage, totals, Z1/Z2)
//  - Initialize(provider, profitToken)
//  - Register DEX (name, router, kind) + Query DEX (name -> router/kind)
//  - Setters: setSimulationMode, setSlippageBps, setQuoterV3, setRadiantPool, setRadiantDataProvider, setUiPoolDataProvider
//  - Flash loan kickers: kickAaveFlash, kickRadiantFlash
//  - runSwapLegs
//  - performRadiantLiquidation
//  - simulateRoute
//  - getUserHealthFactorDynamic
//  - retrieveMsg (r,s1,s2,z1,z2)
//  - Ownership: transferOwnership, renounceOwnership
//  - withdrawToken(token, to)
//  - Event watcher (FlashStart/FlashDone/LegQuoted/LegSwapped/LiquidationResult/DexRegistered/SimulationModeSet/SlippageSet/Inited/Initialized/FinalBalance/QuoterSet)
//
// Usage:
//   npm install inquirer@8 dotenv
//   npx hardhat run scripts/control.js --network arbitrum
//
// Notes:
//  - Arrays: enter comma-separated values (e.g., addresses or uints). Whitespace is trimmed.
//  - Bytes params: enter 0x-prefixed hex. Leave empty to send 0x.
//  - All numbers are treated as raw integers unless otherwise stated.

require("dotenv").config();
const inquirer = require("inquirer");
const { Separator } = inquirer;
const { ethers } = require("hardhat");
const { Wallet } = require("ethers");

// ---- Helpers ----
function isHex(input) {
  return /^0x[0-9a-fA-F]*$/.test(input);
}

function ensureHex(input) {
  if (!input || input === "") return "0x"; // allow empty -> 0x
  return input.startsWith("0x") ? input : "0x" + input;
}

function parseAddress(addr) {
  const a = addr.trim();
  if (!ethers.isAddress(a)) throw new Error(`Invalid address: ${addr}`);
  return a;
}

function parseAddressArray(s) {
  if (!s || s.trim() === "") return [];
  return s
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map(parseAddress);
}

function parseUint(input) {
  const s = String(input).trim();
  if (!/^(\d+)$/.test(s)) throw new Error(`Invalid unsigned integer: ${input}`);
  return BigInt(s);
}

function parseUintArray(s) {
  if (!s || s.trim() === "") return [];
  return s
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map(parseUint);
}

function parseBool(input) {
  const s = String(input).trim().toLowerCase();
  if (["true", "t", "yes", "y", "1"].includes(s)) return true;
  if (["false", "f", "no", "n", "0"].includes(s)) return false;
  throw new Error(`Invalid boolean: ${input}`);
}

function mapDexKind(kindNum) {
  // Adjust as per your actual enum:
  // 0: UniswapV2, 1: UniswapV3, 2: Curve, 3+: Other
  const n = Number(kindNum);
  const map = { 0: "UniswapV2", 1: "UniswapV3", 2: "Curve" };
  return map[n] ?? `Kind#${n}`;
}

async function sendTx(label, promise) {
  const tx = await promise;
  console.log(`📤 ${label} -> pending tx: ${tx.hash}`);
  const rcpt = await tx.wait();
  console.log(`✅ ${label} confirmed in block ${rcpt.blockNumber} | gasUsed: ${rcpt.gasUsed?.toString?.()}`);
  return rcpt;
}

// ---- Main ----
async function main() {
  const CONTRACT_ADDRESS = process.env.MEVBOT_ADDRESS || "";
  const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

  if (!CONTRACT_ADDRESS) throw new Error("Missing MEVBOT_ADDRESS in .env");
  if (!PRIVATE_KEY) throw new Error("Missing PRIVATE_KEY in .env");

  const wallet = new Wallet(PRIVATE_KEY, ethers.provider);
  console.log("🔑 Wallet:", await wallet.getAddress());
  console.log("📡 Network:", (await ethers.provider.getNetwork()).name || (await ethers.provider.getNetwork()).chainId);

  // Get contract instance by name (Hardhat will compile + use ABI)
  const mevBot = await ethers.getContractAt("MEVBotExecutor", CONTRACT_ADDRESS, wallet);
  console.log("🧠 MEVBotExecutor at:", mevBot.target);

  // Menu loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Select an action",
        pageSize: 20,
        choices: [
          new inquirer.Separator("— Overview —"),
          { name: "Status (config & metrics)", value: "status" },

          new inquirer.Separator("— Configuration —"),
          { name: "initialize(provider, profitToken)", value: "initialize" },
          { name: "setSimulationMode(on)", value: "setSimulationMode" },
          { name: "setSlippageBps(bps)", value: "setSlippageBps" },
          { name: "setQuoterV3(address)", value: "setQuoterV3" },
          { name: "setRadiantPool(address)", value: "setRadiantPool" },
          { name: "setRadiantDataProvider(address)", value: "setRadiantDataProvider" },
          { name: "setUiPoolDataProvider(address)", value: "setUiPoolDataProvider" },

          new inquirer.Separator("— DEX Registry —"),
          { name: "registerDex(name, router, kind)", value: "registerDex" },
          { name: "dexRouter(name) / dexKind(name)", value: "queryDex" },

          new inquirer.Separator("— Flash / Swaps / Sim —"),
          { name: "kickAaveFlash(assets[], amounts[], routeParams)", value: "kickAaveFlash" },
          { name: "kickRadiantFlash(assets[], amounts[], routeParams)", value: "kickRadiantFlash" },
          { name: "runSwapLegs(assets[], amounts[], fees[], params)", value: "runSwapLegs" },
          { name: "simulateRoute(params)", value: "simulateRoute" },

          new inquirer.Separator("— Liquidations —"),
          { name: "performRadiantLiquidation(user, collateral, debt, debtToCover, receiveAToken)", value: "performRadiantLiquidation" },
          { name: "getUserHealthFactorDynamic(user, useRadiant)", value: "getUserHealth" },

          new inquirer.Separator("— Introspection —"),
          { name: "retrieveMsg()", value: "retrieveMsg" },
          { name: "getZ1()/getZ2() and Z1()/Z2()", value: "zStuff" },

          new inquirer.Separator("— Admin —"),
          { name: "withdrawToken(token, to)", value: "withdrawToken" },
          { name: "transferOwnership(newOwner)", value: "transferOwnership" },
          { name: "renounceOwnership()", value: "renounceOwnership" },

          new inquirer.Separator("— Events —"),
          { name: "Watch events (press Ctrl+C to exit)", value: "watch" },

          new inquirer.Separator(),
          { name: "Exit", value: "exit" },
        ],
      },
    ]);

    try {
      if (action === "exit") {
        console.log("👋 Bye!");
        break;
      }

      switch (action) {
        case "status":
          await doStatus(mevBot);
          break;

        case "initialize":
          await doInitialize(mevBot);
          break;

        case "setSimulationMode":
          await doSetSimulationMode(mevBot);
          break;

        case "setSlippageBps":
          await doSetSlippageBps(mevBot);
          break;

        case "setQuoterV3":
          await doSetQuoterV3(mevBot);
          break;

        case "setRadiantPool":
          await doSetRadiantPool(mevBot);
          break;

        case "setRadiantDataProvider":
          await doSetRadiantDataProvider(mevBot);
          break;

        case "setUiPoolDataProvider":
          await doSetUiProvider(mevBot);
          break;

        case "registerDex":
          await doRegisterDex(mevBot);
          break;

        case "queryDex":
          await doQueryDex(mevBot);
          break;

        case "kickAaveFlash":
          await doKickAaveFlash(mevBot);
          break;

        case "kickRadiantFlash":
          await doKickRadiantFlash(mevBot);
          break;

        case "runSwapLegs":
          await doRunSwapLegs(mevBot);
          break;

        case "simulateRoute":
          await doSimulateRoute(mevBot);
          break;

        case "performRadiantLiquidation":
          await doPerformRadiantLiquidation(mevBot);
          break;

        case "getUserHealth":
          await doGetUserHealth(mevBot);
          break;

        case "retrieveMsg":
          await doRetrieveMsg(mevBot);
          break;

        case "zStuff":
          await doZStuff(mevBot);
          break;

        case "withdrawToken":
          await doWithdrawToken(mevBot);
          break;

        case "transferOwnership":
          await doTransferOwnership(mevBot);
          break;

        case "renounceOwnership":
          await doRenounceOwnership(mevBot);
          break;

        case "watch":
          await doWatchEvents(mevBot);
          break;

        default:
          console.log("Unknown action");
      }
    } catch (err) {
      console.error("❌ Error:", err.message || err);
    }
  }
}

// ---- Actions ----
async function doStatus(mevBot) {
  const [owner, inited, provider, profitToken, uiProvider, rPool, rData, quoter, simMode, slippage, totalP, totalG, z1, z2] = await Promise.all([
    mevBot.owner(),
    mevBot.initialized(),
    mevBot.provider(), // IPoolAddressesProvider
    mevBot.profitToken(),
    mevBot.uiPoolDataProvider(),
    mevBot.radiantPool(),
    mevBot.radiantDataProvider(),
    mevBot.quoterV3(),
    mevBot.simulationMode(),
    mevBot.slippageBps(),
    mevBot.totalProfits(),
    mevBot.totalGasUsed(),
    mevBot.Z1(),
    mevBot.Z2(),
  ]);

  console.log("\n===== STATUS =====");
  console.log("Owner:", owner);
  console.log("Initialized:", inited);
  console.log("Provider (IPoolAddressesProvider):", provider);
  console.log("Profit token:", profitToken);
  console.log("UI Pool Data Provider:", uiProvider);
  console.log("Radiant Pool:", rPool);
  console.log("Radiant Data Provider:", rData);
  console.log("QuoterV3:", quoter);
  console.log("Simulation mode:", simMode);
  console.log("Slippage bps:", Number(slippage));
  console.log("Total profits:", (totalP ?? 0n).toString());
  console.log("Total gas used:", (totalG ?? 0n).toString());
  console.log("Z1():", z1);
  console.log("Z2():", z2);
  console.log("===================\n");
}

async function doInitialize(mevBot) {
  const { provider, profitToken } = await inquirer.prompt([
    { name: "provider", message: "Provider (IPoolAddressesProvider) address:", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
    { name: "profitToken", message: "Profit token address:", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
  ]);
  await sendTx("initialize", mevBot.initialize(provider, profitToken));
}

async function doSetSimulationMode(mevBot) {
  const { on } = await inquirer.prompt([
    { name: "on", message: "Turn ON simulation mode? (true/false):", default: "true" },
  ]);
  await sendTx("setSimulationMode", mevBot.setSimulationMode(parseBool(on)));
}

async function doSetSlippageBps(mevBot) {
  const { bps } = await inquirer.prompt([
    { name: "bps", message: "Slippage in bps (uint16):", validate: (v) => (/^\d+$/.test(v) ? true : "Enter integer bps") },
  ]);
  await sendTx("setSlippageBps", mevBot.setSlippageBps(Number(bps)));
}

async function doSetQuoterV3(mevBot) {
  const { addr } = await inquirer.prompt([
    { name: "addr", message: "QuoterV3 address:", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
  ]);
  await sendTx("setQuoterV3", mevBot.setQuoterV3(addr));
}

async function doSetRadiantPool(mevBot) {
  const { addr } = await inquirer.prompt([
    { name: "addr", message: "Radiant Pool address:", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
  ]);
  await sendTx("setRadiantPool", mevBot.setRadiantPool(addr));
}

async function doSetRadiantDataProvider(mevBot) {
  const { addr } = await inquirer.prompt([
    { name: "addr", message: "Radiant Data Provider address:", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
  ]);
  await sendTx("setRadiantDataProvider", mevBot.setRadiantDataProvider(addr));
}

async function doSetUiProvider(mevBot) {
  const { addr } = await inquirer.prompt([
    { name: "addr", message: "UI Pool Data Provider address:", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
  ]);
  await sendTx("setUiPoolDataProvider", mevBot.setUiPoolDataProvider(addr));
}

async function doRegisterDex(mevBot) {
  const { name, router, kind } = await inquirer.prompt([
    { name: "name", message: "DEX name (string key):", validate: (v) => (v && v.trim().length > 0 ? true : "Enter non-empty string") },
    { name: "router", message: "Router address:", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
    { name: "kind", message: "DexKind (uint8 number):", validate: (v) => (/^\d+$/.test(v) ? true : "Enter uint8 number") },
  ]);
  await sendTx("registerDex", mevBot.registerDex(name.trim(), router, Number(kind)));
}

async function doQueryDex(mevBot) {
  const { name } = await inquirer.prompt([
    { name: "name", message: "DEX name (string key to query):", validate: (v) => (v && v.trim().length > 0 ? true : "Enter non-empty string") },
  ]);
  const [router, kind] = await Promise.all([
    mevBot.dexRouter(name.trim()),
    mevBot.dexKind(name.trim()),
  ]);
  console.log(`\nDEX '${name}': router=${router}, kind=${Number(kind)} (${mapDexKind(kind)})\n`);
}

async function doKickAaveFlash(mevBot) {
  const answers = await inquirer.prompt([
    { name: "assets", message: "assets[] (comma-separated addresses):" },
    { name: "amounts", message: "amounts[] (comma-separated uints):" },
    { name: "routeParams", message: "routeParams bytes (0x...):", default: "0x" },
  ]);
  const assets = parseAddressArray(answers.assets);
  const amounts = parseUintArray(answers.amounts);
  const params = ensureHex(answers.routeParams);
  if (!isHex(params)) throw new Error("routeParams must be 0x-hex");
  await sendTx("kickAaveFlash", mevBot.kickAaveFlash(assets, amounts, params));
}

async function doKickRadiantFlash(mevBot) {
  const answers = await inquirer.prompt([
    { name: "assets", message: "assets[] (comma-separated addresses):" },
    { name: "amounts", message: "amounts[] (comma-separated uints):" },
    { name: "routeParams", message: "routeParams bytes (0x...):", default: "0x" },
  ]);
  const assets = parseAddressArray(answers.assets);
  const amounts = parseUintArray(answers.amounts);
  const params = ensureHex(answers.routeParams);
  if (!isHex(params)) throw new Error("routeParams must be 0x-hex");
  await sendTx("kickRadiantFlash", mevBot.kickRadiantFlash(assets, amounts, params));
}

async function doRunSwapLegs(mevBot) {
  const answers = await inquirer.prompt([
    { name: "assets", message: "assets[] (comma-separated addresses):" },
    { name: "amounts", message: "amounts[] (comma-separated uints):" },
    { name: "fees", message: "fees[] (comma-separated uints):" },
    { name: "params", message: "params bytes (0x...):", default: "0x" },
  ]);
  const assets = parseAddressArray(answers.assets);
  const amounts = parseUintArray(answers.amounts);
  const fees = parseUintArray(answers.fees);
  const params = ensureHex(answers.params);
  if (!isHex(params)) throw new Error("params must be 0x-hex");
  await sendTx("runSwapLegs", mevBot.runSwapLegs(assets, amounts, fees, params));
}

async function doSimulateRoute(mevBot) {
  const { params } = await inquirer.prompt([
    { name: "params", message: "params bytes (0x...):", default: "0x" },
  ]);
  const p = ensureHex(params);
  if (!isHex(p)) throw new Error("params must be 0x-hex");
  const res = await mevBot.simulateRoute(p);
  // returns (ok, estProfit, finalToken, estOut)
  console.log("\nSIM RESULT:");
  console.log("ok:", res.ok);
  console.log("estProfit:", (res.estProfit ?? 0n).toString());
  console.log("finalToken:", res.finalToken);
  console.log("estOut:", (res.estOut ?? 0n).toString());
  console.log();
}

async function doPerformRadiantLiquidation(mevBot) {
  const answers = await inquirer.prompt([
    { name: "user", message: "user (address):", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
    { name: "collateral", message: "collateralAsset (address):", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
    { name: "debt", message: "debtAsset (address):", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
    { name: "debtToCover", message: "debtToCover (uint):", validate: (v) => (/^\d+$/.test(v) ? true : "Enter integer") },
    { name: "receiveAToken", message: "receiveAToken (true/false):", default: "false" },
  ]);
  await sendTx(
    "performRadiantLiquidation",
    mevBot.performRadiantLiquidation(
      parseAddress(answers.user),
      parseAddress(answers.collateral),
      parseAddress(answers.debt),
      parseUint(answers.debtToCover),
      parseBool(answers.receiveAToken)
    )
  );
}

async function doGetUserHealth(mevBot) {
  const { user, useRadiant } = await inquirer.prompt([
    { name: "user", message: "user (address):", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
    { name: "useRadiant", message: "useRadiant (true/false):", default: "false" },
  ]);
  const res = await mevBot.getUserHealthFactorDynamic(parseAddress(user), parseBool(useRadiant));
  console.log("\nHEALTH:");
  console.log("totalCollateral:", (res.totalCollateral ?? 0n).toString());
  console.log("totalDebt:", (res.totalDebt ?? 0n).toString());
  console.log("availableBorrows:", (res.availableBorrows ?? 0n).toString());
  console.log("liqThreshold:", (res.liqThreshold ?? 0n).toString());
  console.log("ltv:", (res.ltv ?? 0n).toString());
  console.log("healthFactor:", (res.healthFactor ?? 0n).toString());
  console.log();
}

async function doRetrieveMsg(mevBot) {
  const res = await mevBot.retrieveMsg();
  console.log("\nRETRIEVE MSG:");
  console.log("r:", res.r);
  console.log("s1:", (res.s1 ?? 0n).toString());
  console.log("s2:", (res.s2 ?? 0n).toString());
  console.log("z1:", res.z1);
  console.log("z2:", res.z2);
  console.log();
}

async function doZStuff(mevBot) {
  const [Z1view, Z2view, z1, z2] = await Promise.all([mevBot.Z1(), mevBot.Z2(), mevBot.getZ1(), mevBot.getZ2()]);
  console.log("\nZ VALUES:");
  console.log("Z1() view:", Z1view);
  console.log("Z2() view:", Z2view);
  console.log("getZ1() pure:", z1);
  console.log("getZ2() pure:", z2);
  console.log();
}

async function doWithdrawToken(mevBot) {
  const { token, to } = await inquirer.prompt([
    { name: "token", message: "token address:", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
    { name: "to", message: "recipient address:", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
  ]);
  await sendTx("withdrawToken", mevBot.withdrawToken(token, to));
}

async function doTransferOwnership(mevBot) {
  const { newOwner } = await inquirer.prompt([
    { name: "newOwner", message: "newOwner address:", validate: (v) => (ethers.isAddress(v) ? true : "Invalid address") },
  ]);
  await sendTx("transferOwnership", mevBot.transferOwnership(newOwner));
}

async function doRenounceOwnership(mevBot) {
  const { confirm } = await inquirer.prompt([
    { type: "confirm", name: "confirm", message: "Are you sure you want to renounceOwnership?", default: false },
  ]);
  if (!confirm) return console.log("Cancelled.");
  await sendTx("renounceOwnership", mevBot.renounceOwnership());
}

async function doWatchEvents(mevBot) {
  console.log("\n👀 Watching events... Press Ctrl+C to exit.\n");
  const log = (...args) => console.log(new Date().toISOString(), ...args);

  mevBot.on("FlashStart", (pool, assets, amounts, routeHash, ev) => {
    log("FlashStart:", { pool, assets, amounts: amounts.map((x) => x.toString()), routeHash, tx: ev?.log?.transactionHash });
  });
  mevBot.on("FlashDone", (success, profit, profitToken, routeHash, reason, gasUsed, ev) => {
    log("FlashDone:", { success, profit: profit.toString(), profitToken, routeHash, reason, gasUsed: gasUsed.toString(), tx: ev?.log?.transactionHash });
  });
  mevBot.on("LegQuoted", (index, dex, tokenIn, tokenOut, amountIn, amountOut, ev) => {
    log("LegQuoted:", { index: Number(index), dex, tokenIn, tokenOut, amountIn: amountIn.toString(), amountOut: amountOut.toString(), tx: ev?.log?.transactionHash });
  });
  mevBot.on("LegSwapped", (index, dex, tokenIn, tokenOut, amountIn, amountOut, router, ev) => {
    log("LegSwapped:", { index: Number(index), dex, tokenIn, tokenOut, amountIn: amountIn.toString(), amountOut: amountOut.toString(), router, tx: ev?.log?.transactionHash });
  });
  mevBot.on("LiquidationResult", (success, collateral, debt, user, amount, gasUsed, reason, ev) => {
    log("LiquidationResult:", { success, collateral, debt, user, amount: amount.toString(), gasUsed: gasUsed.toString(), reason, tx: ev?.log?.transactionHash });
  });
  mevBot.on("DexRegistered", (name, router, kind) => {
    log("DexRegistered:", { name, router, kind: Number(kind), kindText: mapDexKind(kind) });
  });
  mevBot.on("SimulationModeSet", (on) => {
    log("SimulationModeSet:", { on });
  });
  mevBot.on("SlippageSet", (bps) => {
    log("SlippageSet:", { bps: Number(bps) });
  });
  mevBot.on("Inited", (provider, profitToken) => {
    log("Inited:", { provider, profitToken });
  });
  mevBot.on("Initialized", (sender, magic, variant) => {
    log("Initialized:", { sender, magic: magic.toString(), variant: Number(variant) });
  });
  mevBot.on("FinalBalance", (token, balance) => {
    log("FinalBalance:", { token, balance: balance.toString() });
  });
  mevBot.on("QuoterSet", (quoter) => {
    log("QuoterSet:", { quoter });
  });

  // keep process alive
  // eslint-disable-next-line no-empty
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

