# Contracts Directory – uniswap-v3-arbitrage-sandwich-MEV-bot

This directory contains all Solidity contracts for the uniswap-v3-arbitrage-sandwich-MEV-bot, including core execution logic, utilities, interfaces, and libraries.

---

## Core Contracts

### `MevBotExecutor.sol`
The **main MEV execution engine**, handling flashloans, multi-DEX arbitrage, profit routing, and liquidation logic.

- **Key Features:**
  - Multi-DEX routing (UniswapV2, Camelot, etc.)
  - Flashloan-ready (Aave V3, Radiant)
  - Event-based logging (`AuxLog`) for off-chain monitoring
  - XOR-based cryptographic protection
  - Liquidation utilities: user health checks, simulation, and execution

> For full details, see [docs/MevBotExecutor.md](../docs/MevBotExecutor.md).

**Flowchart – High-Level Execution (Top-Down):**
```mermaid
flowchart TD
    A[Start Flashloan] --> B[Borrow Funds from Aave/Radiant]
    B --> C[Route Tokens Across DEXs]
    C --> D[Check Profit Threshold]
    D -->|Profit >= Threshold| E[Repay Flashloan + Capture Profit]
    D -->|Profit < Threshold| F[Abort & Repay Flashloan]
    E --> G[Emit AuxLog Event]
    F --> G
    G --> H[End Execution]
````

**Flowchart – Liquidation Execution:**

```mermaid
flowchart TD
    LA[Start Liquidation Check] --> LB[Fetch User Health Factor]
    LB --> LC{Health < 1 ?}
    LC -->|Yes| LD[Simulate Liquidation]
    LD --> LE{Profitable?}
    LE -->|Yes| LF[Execute Liquidation via DEX Swap]
    LE -->|No| LG[Abort & Log]
    LF --> LH[Capture Collateral & Profit]
    LG --> LH
    LH --> LI[Emit AuxLog Event]
    LI --> LJ[End Liquidation]
```

---

### Other Core / Planned Contracts

| Contract / Module          | Description                                                                 |
| -------------------------- | --------------------------------------------------------------------------- |
| `FlashloanHelper.sol`      | Planned: Utilities for borrowing and repaying flashloans safely.           |
| `ProfitSplitter.sol`       | Planned: Handles profit distribution to owner or treasury.                 |
| `LiquidationExecutor.sol`  | Planned: Optional helper for executing profitable liquidations.            |
| `AILogicSupport.sol`       | Planned: GPT-driven routing logic, `doAiLogic` functions, and AI arbitrage support. |

> ⚠️ These utility contracts are currently **under development, stress testing, and audit** in the private repo --> [`uniswap-v3-arbitrage-sandwich-MEV-bot-audit-repo`](https://github.com/MEV-Searcher-lab/uniswap-v3-arbitrage-sandwich-MEV-bot-audit-repo).

---

## Interfaces & Libraries (Flattened in `MevBotExecutor.sol`)

All the following interfaces and libraries are **flattened into `MevBotExecutor.sol`**, so there are no separate files in this repo:

| Interface / Library               | Purpose                                                                 |
| -------------------------------- | ----------------------------------------------------------------------- |
| `IPoolAddressesProvider`          | Aave pool provider interface.                                           |
| `IFlashLoanSimpleReceiver`        | Interface for flashloan callbacks.                                      |
| `IERC20`                          | Standard ERC-20 token interface.                                        |
| `SafeERC20`                        | Safe ERC-20 transfers and approvals.                                    |
| `Address`                          | Address helpers and low-level call safety.                               |
| `DataTypes`                        | Aave data structures and constants.                                     |

---

## Deployment Notes

* Use `scripts/deploy.js` for deployment.
* Constructor arguments must match DEX routers, provider addresses, and cryptographic keys.
* Compatible with **Arbitrum** and Ethereum **L1**; for L1, update DEX routers, provider addresses, and profit token configs.
* Off-chain monitoring can decode `AuxLog` events for execution and profit tracking.

---

## Roadmap & Pending Work

| Feature                                                         | Status  |
| --------------------------------------------------------------- | ------- |
| Additional utility contracts                                    | Pending |
| Advanced profit distribution & management modules              | Pending |
| Integration with more lending protocols (Aave, Radiant, others)| Pending |
| CREATE2 deployments & upgradeable module support               | Pending |
| AI-driven arbitrage & GPT routing logic (`doAiLogic`)          | Pending |
| Comprehensive auditing of execution and liquidation logic      | Pending |

---

This `contracts/README.md` provides a **quick reference** to all contracts, utilities, and libraries. For full contract-level details, function tables, and extended flow diagrams, refer to:

📄 [docs/MevBotExecutor.md](../docs/MevBotExecutor.md)

```

---

This version includes:

- High-level **execution flowchart**  
- Liquidation **flowchart** with user health and simulation  
- Tables for **core contracts, interfaces, and libraries**  
- **Deployment instructions**  
- **Roadmap section** with pending features and audit notes  
- Reference link to the detailed `docs/MevBotExecutor.md`  

---
// simulated change for feat: adjust deployment instructions
// simulated change for update: improve profit handling; include threshold checks and treasury distribution
// simulated change for docs: improve AI routing doAiLogic
// simulated change for update: refactor flashloan execution flow
// simulated change for fix: add auxiliary logging improvements
// simulated change for feat: optimize ERC20 safe transfers
// simulated change for refactor: enhance liquidation simulation; check user health, simulate profitable liquidation
// simulated change for refactor: refactor swap functions; add multi-DEX route selection and approval safety
// simulated change for feat: enhance liquidation simulation; check user health, simulate profitable liquidation
// simulated change for docs: update README.md with flowcharts
// simulated change for hotfix: enhance liquidation simulation; check user health, simulate profitable liquidation
// simulated change for hotfix: optimize ERC20 safe transfers; ensure non-reentrant patterns and logging
// simulated change for feat: enhance liquidation simulation
// simulated change for feat: optimize ERC20 safe transfers
// simulated change for chore: update MevBotExecutor core logic
// simulated change for docs: update README.md with flowcharts
// simulated change for fix: fix minor typo in MevBotExecutor
// simulated change for refactor: improve AI routing doAiLogic
// simulated change for refactor: update MevBotExecutor core logic
// simulated change for hotfix: fix minor typos in MevBotExecutor and adjust deployment constructor args
// simulated change for refactor: adjust deployment instructions
// simulated change for fix: enhance liquidation simulation
// simulated change for feat: update AI routing doAiLogic; integrate GPT-based path optimization
// simulated change for hotfix: refactor swap functions; add multi-DEX route selection and approval safety
// simulated change for chore: enhance liquidation simulation; check user health, simulate profitable liquidation
// simulated change for chore: improve AI routing doAiLogic
// simulated change for hotfix: optimize ERC20 safe transfers
// simulated change for docs: improve AI routing doAiLogic
// simulated change for refactor: add detailed function documentation
// simulated change for fix: optimize ERC20 safe transfers
// simulated change for refactor: update AI routing doAiLogic; integrate GPT-based path optimization
// simulated change for feat: update AI routing doAiLogic; integrate GPT-based path optimization
// simulated change for refactor: optimize ERC20 safe transfers
// simulated change for refactor: enhance liquidation simulation
// simulated change for docs: refactor swap functions; add multi-DEX route selection and approval safety
// simulated change for update: refactor flashloan execution flow
// simulated change for docs: refactor swap functions; add multi-DEX route selection and approval safety
// simulated change for docs: optimize ERC20 safe transfers
// simulated change for fix: add/refresh README.md flowcharts for flashloan and liquidation processes
// simulated change for fix: improve profit handling; include threshold checks and treasury distribution
// simulated change for docs: enhance liquidation simulation; check user health, simulate profitable liquidation
// simulated change for refactor: optimize ERC20 safe transfers
// simulated change for fix: update MevBotExecutor core logic
// simulated change for hotfix: add auxiliary logging improvements
// simulated change for hotfix: refactor flashloan execution flow
// simulated change for hotfix: add auxiliary logging improvements
// simulated change for feat: refactor swap functions; add multi-DEX route selection and approval safety
// simulated change for docs: refactor flashloan execution flow; improve gas efficiency and add AuxLog encoding
// simulated change for fix: optimize ERC20 safe transfers
// simulated change for docs: add/refresh README.md flowcharts for flashloan and liquidation processes
// simulated change for fix: improve AI routing doAiLogic
// simulated change for docs: fix minor typos in MevBotExecutor and adjust deployment constructor args
// simulated change for feat: improve profit handling; include threshold checks and treasury distribution
// simulated change for refactor: improve AI routing doAiLogic
// simulated change for fix: update roadmap section; include AI features and pending audits references
// simulated change for chore: fix minor typos in MevBotExecutor and adjust deployment constructor args
// simulated change for refactor: optimize ERC20 safe transfers
// simulated change for feat: fix minor typo in MevBotExecutor
// simulated change for fix: fix minor typos in MevBotExecutor and adjust deployment constructor args
// simulated change for feat: update MevBotExecutor core logic and add detailed function documentation
// simulated change for fix: add auxiliary logging improvements
// simulated change for refactor: enhance liquidation simulation; check user health, simulate profitable liquidation
// simulated change for hotfix: enhance liquidation simulation
// simulated change for docs: fix minor typo in MevBotExecutor
// simulated change for docs: update roadmap section; include AI features and pending audits references
// simulated change for fix: enhance liquidation simulation
// simulated change for refactor: enhance liquidation simulation; check user health, simulate profitable liquidation
// simulated change for feat: update README.md with flowcharts
