# MevBotExecutor.sol – Detailed Documentation

## Overview

`MevBotExecutor.sol` is the core contract of the uniswap-v3-arbitrage-sandwich-MEV-bot ecosystem. It integrates multiple flattened libraries to enable atomic arbitrage, liquidation, DEX interactions, and post-sequencer profit capture. It is designed to work with lending protocols, liquidity pools, and DEX routers while maintaining safety and efficiency in flashloan and Mev executions.

---

## Flattened Libraries and Interfaces

`MevBotExecutor.sol` integrates multiple flattened libraries and interfaces to support flashloan execution, token handling, DEX routing, and secure contract operations.

---

### 1. Aave Protocol Interfaces

#### **IPoolAddressesProvider.sol**
* **Purpose:** Provides access to the pool and configurator addresses for flashloans.
* **Key Use:** Retrieves pool addresses dynamically, enabling interaction with lending protocols without hardcoding.
* **Main Functions / Events:**
  - `MarketIdSet` – emits when the market ID changes.
  - `PoolUpdated` – emits when pool address changes.
  - `PoolConfiguratorUpdated` – emits when configurator updates.

#### **IPool.sol**
* **Purpose:** Core Aave lending pool interface for deposits, withdrawals, and flashloans.
* **Key Use:** Enables borrowing funds, executing flashloans, and interacting with user reserves.
* **Main Functions / Events:**
  - `flashLoanSimple` – execute a flashloan for a single asset.
  - `getUserAccountData` – fetch user collateral, debt, and health factor.
  - `liquidationCall` – trigger liquidation of undercollateralized positions.

#### **IFlashLoanSimpleReceiver.sol**
* **Purpose:** Interface for contracts receiving Aave flashloans.
* **Key Use:** Defines the callback function `executeOperation` that is invoked after flashloan execution.
* **Main Functions:**
  - `executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params)` – called by Aave after lending the flashloan.

#### **DataTypes.sol**
* **Purpose:** Type definitions for Aave v3 protocol (e.g., ReserveData, UserConfigurationMap).
* **Key Use:** Provides structured data formats for interacting with pools and tracking reserves.

---

### 2. OpenZeppelin Libraries

#### **IERC20.sol**
* **Purpose:** Standard ERC-20 interface for token operations.
* **Key Use:** Approve, transfer, and check balances of tokens involved in arbitrage or flashloan repayment.
* **Main Functions:**
  - `balanceOf(address account)`
  - `transfer(address to, uint256 amount)`
  - `transferFrom(address from, address to, uint256 amount)`
  - `approve(address spender, uint256 amount)`

#### **SafeERC20.sol**
* **Purpose:** Safe wrapper around ERC-20 operations to handle non-standard implementations.
* **Key Use:** Handles `transfer`, `transferFrom`, and `approve` safely.
* **Main Functions:**
  - `safeTransfer`
  - `safeTransferFrom`
  - `safeApprove`

#### **Context.sol**
* **Purpose:** Provides execution context for contracts, including `msg.sender` and `msg.data`.
* **Key Use:** Base contract for Ownable and other access-controlled contracts.

#### **Ownable.sol**
* **Purpose:** Access control for administrative functions.
* **Key Use:** Restrict functions to the contract owner (`onlyOwner` modifier).

#### **ReentrancyGuard.sol**
* **Purpose:** Prevents reentrancy attacks.
* **Key Use:** Wrap sensitive functions with `nonReentrant` modifier to prevent nested calls.

---

### 3. MevBotExecutor.sol (Custom Contract)

* **Purpose:** Core contract for multi-DEX arbitrage, flashloan execution, and liquidation strategies.
* **Key Use:** Coordinates borrowing, swaps, repayment, profit extraction, and off-chain logging.
* **Key Features:**
  - Flashloan-ready (Aave v3 / Radiant)
  - Multi-DEX routing (UniswapV2, UniswapV3, Camelot)
  - XOR-based event logging (`AuxLog`) for off-chain auditing
  - Liquidation execution with user health checks and simulation
  - Cryptographic protection using XOR keys
  - Safe ERC-20 handling and hardened security

---

This structure covers all flattened libraries/interfaces from:

- `@aave/core-v3/contracts/...` (DataTypes, IPool, IPoolAddressesProvider, IFlashLoanSimpleReceiver)  
- `@openzeppelin/contracts/...` (IERC20, SafeERC20, Context, Ownable, ReentrancyGuard)  
- Custom contract: `MevBotExecutor.sol`  

```

## Main Contract: MevBotExecutor

### State Variables

* **Dex Routers & Kind**

  * Arrays storing DEX addresses and types (UniswapV2, Camelot, etc.) for routing swaps.

* **Provider & Profit Tokens**

  * `providerAddr` – Aave or other lending pool address.
  * `profitTokenAddr` – The token used for capturing profits.

* **Control Parameters / Keys**

  * `r`, `s1`, `s2`, `z1`, `z2`, `xorKey_` – cryptographic parameters for internal XOR-encoded logging, replay prevention, and key recovery.

* **Auxiliary Mappings / Storage**

  * Storage for tracking executed transactions, nonce reuse prevention, and flashloan bookkeeping.

---

### Events

* **AuxLog(bytes data)** – Used to emit XOR-encoded logs, enabling off-chain key recovery and audit without exposing sensitive data on-chain.

---

### Core Functions

1. **Constructor**

   * **Purpose:** Initializes the `MevBotExecutor` contract with all necessary DEX, provider, token, and cryptographic parameters for flashloan, arbitrage, and liquidation operations.
   * **Deployment Arguments:**

     | Argument | Type | Description | Example |
     |----------|------|------------|---------|
     | `dexRouters` | `address[]` | Array of DEX router addresses for swaps | `["0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", "0xE592427A0AEce92De3Edee1F18E0157C05861564", "0x2191718CD32d02B8E60BAdFFeA33E4B5DD9A0A0D"]` |
     | `dexKinds` | `uint8[]` | DEX type identifiers (0 = Sushi V2, 1 = Uniswap V3, 2 = Camelot V3) | `[0,1,2]` |
     | `providerAddr` | `address` | Lending pool provider address for flashloans (Aave/Radiant) | `0xa97684ead0e402dc232d5a977953df7ecbab3cdb` |
     | `profitTokenAddr` | `address` | ERC-20 token used for capturing profits | `0xff970a61a04b1ca14834a43f5de4533ebddb5cc8` |
     | `radiantAddr` | `address` | Radiant protocol address for flashloan orchestration | `0x454a8daf74b24037ee2fa073ce1be9277ed6160a` |
     | `uiProvider` | `address` | Frontend or oracle provider interface | `0x5c5228aC8BC1528482514aF3e27E692495148717` |
     | `radiantData` | `address` | Radiant-specific data contract address | `0x56D4b07292343b149E0c60c7C41B7B1eEefdD733` |
     | `quoterAddr` | `address` | Quote provider address for swap estimation | `0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6` |
     | `rHex` | `bytes32` | Cryptographic parameter used for XOR-encoded logging | `0x...` |
     | `s1Big` | `uint256` | Cryptographic key parameter for internal encoding | `...` |
     | `s2Big` | `uint256` | Cryptographic key parameter for internal encoding | `...` |
     | `z1` | `bytes32` | XOR/logging key for replay prevention | `0x...` |
     | `z2` | `bytes32` | XOR/logging key for replay prevention | `0x...` |
     | `xorKey_` | `bytes32` | Main XOR key for encoding sensitive logs | `0x...` |

   * **Notes:**
     - The constructor **emits initial `AuxLog` events** for off-chain recovery of configuration and keys.  
     - All addresses must be trusted and verified before deployment.  
     - Cryptographic parameters (`rHex`, `s1Big`, `s2Big`, `z1`, `z2`, `xorKey_`) are essential for internal XOR-encoding and replay protection.

   * **Example Deployment Snippet (Hardhat / Ethers.js):**

   ```javascript
   const MEVBot = await ethers.getContractFactory("MevBotExecutor");
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
       s2Big,
       z1,
       z2,
       xorKey_
   );
   await mevBot.deployed();
   console.log("MevBotExecutor deployed at:", mevBot.address);
   ```

---

2. **Flashloan Execution Function**

   * **Purpose:** Performs atomic flashloan operations to exploit arbitrage opportunities across multiple DEXs.
   * **Workflow:**
     1. Borrow funds from Aave/Radaint (or another configured lending provider) via `flashLoanSimple` or `flashLoanMultiple`.
     2. Execute multi-step arbitrage:
        - Swap tokens across configured DEX routers.
        - Follow routing logic for maximal profit.
        - Use `getQuote` utility to estimate outputs before executing swaps.
     3. Repay the flashloan along with any premium within the same transaction.
     4. Emit `AuxLog` for off-chain monitoring and auditing of profit, swap paths, and loan repayment.
   * **Key Functions Involved:** `executeFlashloan()`, `swapTokens()`, `AuxLogEncode()`  

---

3. **Swap Functions**

   * **Purpose:** Handles token swapping across multiple DEXs safely and efficiently.
   * **Workflow:**
     1. Receive input token, target token, and swap amount.
     2. Determine the optimal DEX router from `dexRouters` and `dexKinds`.
     3. Approve token transfer dynamically using `SafeERC20`.
     4. Execute swap via router function:
        - UniswapV2/Sushi-style: `swapExactTokensForTokens`
        - UniswapV3/Camelot-style: `exactInputSingle`
     5. Return swapped amount to calling function.
   * **Key Functions Involved:** `swapTokens(fromToken, toToken, amount, dex)`  

---

4. **Liquidation Functions**

   * **Purpose:** Safely detect and execute liquidations on undercollateralized users.
   * **Workflow:**
     1. **Get User Health:**  
        - Call `getUserHealth(user)` to retrieve the user’s health factor from the lending protocol.  
        - Health factor < 1 indicates the user is eligible for liquidation.
     2. **Simulate Liquidation:**  
        - Use `simulateLiquidation(user)` to estimate the outcome off-chain.  
        - Prevents failed liquidations and unexpected losses.
     3. **Execute Liquidation:**  
        - If simulation succeeds, call `executeLiquidation(user, debtToken, collateralToken)` to liquidate the user position atomically.  
        - Repay the user’s debt and claim collateral.
     4. **Profit Handling:**  
        - Any profit from liquidation is transferred to the owner/treasury via `handleProfit()`.
     5. **Auxiliary Logging:**  
        - Emit `AuxLog` events encoding liquidation execution details for off-chain monitoring and auditing.
   * **Key Functions Involved:**  
     - `getUserHealth(user)` – calculates health factor.  
     - `simulateLiquidation(user)` – simulates liquidation outcome.  
     - `executeLiquidation(user, debtToken, collateralToken)` – performs atomic liquidation.  
     - `handleProfit()` – transfers profit to owner.  
     - `AuxLogEncode()` / `AuxLogDecode()` – secure event logging.  

   * **Security Notes:**  
     - Only liquidate users whose health factor is below 1.  
     - Always simulate before executing to avoid transaction revert or loss.  
     - Safe ERC-20 handling ensures collateral and repayment are correctly transferred.  
     - Nonce/replay protection and XOR logging prevent double liquidation attacks.

---

5. **Profit Handling**

   * **Purpose:** Ensure flashloan operations generate net positive returns and safely distribute profits.
   * **Workflow:**
     1. Calculate profit by comparing input borrowed amount vs. post-arbitrage holdings.
     2. Verify profit exceeds configured minimum threshold.
     3. Transfer profit to owner or treasury address via `SafeERC20`.
     4. Emit `AuxLog` indicating profit transfer and final balances.
   * **Key Functions Involved:** `handleProfit()`, `AuxLogEncode()`  

---

6. **Safety / Helper Functions**

   * **Purpose:** Harden contract against common DeFi risks including reentrancy, replay attacks, and faulty token transfers.
   * **Mechanisms:**
     - **Nonce / Replay Protection:** XOR-encoded keys (`r`, `s1`, `s2`, `z1`, `z2`, `xorKey_`) prevent repeated or unauthorized transactions.
     - **Safe ERC-20 Transfers:** All token movements use `SafeERC20` to handle non-standard ERC-20s safely.
     - **Contract Existence Checks:** Uses `Address.isContract` before performing external calls to avoid calling non-contract addresses.
     - **Non-Reentrancy:** Functions wrapped with `nonReentrant` modifier (via `ReentrancyGuard`) where applicable.
     - **Validation:** Checks for minimum profit threshold and swap feasibility before executing.
   * **Key Functions Involved:** `AuxLogEncode()`, `AuxLogDecode()`, `isContract()`, `nonReentrant`-protected functions
 * Checks for contract existence before calling external addresses

---

### Features

* **Multi-DEX Arbitrage** – Supports routing across UniswapV2-style routers, Camelot, and other integrated DEXs.  
* **Flashloan Ready** – Fully compatible with Aave V3 and Radiant flashloans.  
* **Event-Based Logging** – Uses `AuxLog` to safely encode internal data for off-chain recovery and auditing.  
* **Cryptographic Protection** – XOR-based keys (`r`, `s1`, `s2`, `z1`, `z2`, `xorKey_`) prevent sensitive on-chain data leakage.  
* **Liquidation Strategy** – Supports user health monitoring, off-chain simulation, and atomic liquidation execution.  
* **Profit Handling & Treasury Management** – Ensures minimum profit thresholds and safe transfer of profits to owner or treasury.  
* **Upgradeable Logic Compatibility** – While not itself a proxy, designed to work with upgradeable routing modules and external orchestrators.  
* **Utilities & Monitoring** – Includes `getQuote`, `getUserHealth`, and simulation functions for safe execution.

---

### Security Considerations (Hardened)

* **External Call Safety** – All calls to external contracts use `Address.functionCall` to prevent reentrancy and failed low-level calls.  
* **ERC-20 Safety** – Token transfers, approvals, and interactions use `SafeERC20` to handle non-standard ERC-20 implementations robustly.  
* **Nonce / Replay Protection** – XOR-encoded keys prevent replay attacks and unauthorized transaction execution.  
* **Liquidation Safety** – Simulations run before executing liquidations to prevent loss or failed txs; only users with health factor < 1 are targeted.  
* **Minimum Profit Enforcement** – Arbitrage and liquidation functions enforce minimum profit thresholds to prevent loss-making executions.  
* **Trusted Addresses Required** – All DEX routers, lending providers, and protocol contracts must be verified and trusted.  
* **Non-Reentrancy** – Critical functions are protected with `nonReentrant` modifier from `ReentrancyGuard`.  
* **AuxLog Monitoring** – XOR-encoded logs enable off-chain auditing without exposing sensitive data on-chain.

---

### Security & Feature Ranking

| Category | Score (1-5) | Notes |
|----------|-------------|-------|
| Arbitrage Potential | 5 | Multi-DEX routing and dynamic swap paths maximize opportunities |
| Flashloan Safety | 5 | Atomic execution ensures full repayment and avoids losses |
| Liquidation Efficiency | 4 | Simulation reduces risk; only triggers when safe |
| Logging / Auditing | 5 | XOR-based logs allow secure off-chain monitoring |
| Overall Security | 5 | Hardened with SafeERC20, Address checks, nonce protection, and non-reentrancy |

---

### Recommended Usage / Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/MEV-Searcher-lab/uniswap-v3-arbitrage-sandwich-MEV-bot.git
   cd uniswap-v3-arbitrage-sandwich-MEV-bot
````

2. **Install Dependencies**

   ```bash
   npm ci
   ```

3. **Configure Your Private Key**

   * Create a `.env` file in the project root (or edit the provided `.env`):

     ```
     PRIVATE_KEY=your_wallet_private_key_here
     ```
   * Alternatively, append it directly using echo:

     ```bash
     echo "PRIVATE_KEY=your_wallet_private_key_here" >> .env
     ```
   * This private key will be used for deployment and transaction signing.

4. **Network Configuration**

   * **Arbitrum Deployment (default)**

     * No changes needed; the default DEX routers, Aave provider, profit token, UI, Radiant addresses are pre-configured for Arbitrum.
     * Deploy with:

       ```bash
       node scripts/deploy.js --network arbitrum
       ```
   * **Ethereum L1 / Other Networks**

     * Update deployment arguments in `scripts/deploy.js` or the constructor args:

       * `dexRouters` – new router addresses on the target network
       * `providerAddr` – new lending pool provider address
       * `profitTokenAddr` – profit token on L1
       * `uiProvider` / `radiantAddr` / `radiantData` – network-specific addresses
     * Then deploy with:

       ```bash
       node scripts/deploy.js --network mainnet
       ```

5. **Deploy Contract**

   * The deployment script will automatically read the `.env` private key and constructor parameters.
   * Upon success, you’ll see the deployed contract address logged in the console.

6. **Trigger Flashloan / Arbitrage**

   * Use `control.js` or another orchestrator script to call `executeFlashloan()`.
   * Optionally check quotes beforehand via `getQuote()` to optimize routing.

7. **Liquidations**

   * Check user health with `getUserHealth(user)`.
   * Run `simulateLiquidation(user)` to verify execution.
   * Call `executeLiquidation(user, debtToken, collateralToken)` only if simulation is successful.

8. **Off-Chain Monitoring**

   * Decode `AuxLog` events to monitor profits, executed swaps, and liquidation outcomes.

---

- feat: adjust Arbitrum vs L1 network notes
- visuals: clarify safety and helper functions
- oops: include XOR-based AuxLog explanation
- refactor: refresh deployment script instructions
- visuals: update flashloan execution section
- chore: refactor core functions for clarity
- visuals: clarify safety and helper functions
- chore: improve Mermaid flowchart references
- feat: refactor core functions for clarity
- fix: add .env and private key setup guide
- oops: refresh deployment script instructions
- update: refresh deployment script instructions
- hotfix: fix swap function descriptions
- docs: enhance features and security considerations
- feat: include liquidation strategy explanation
- refactor: include XOR-based AuxLog explanation
- fix: update flashloan execution section
- chore: update flashloan execution section
- chore: update recommended usage instructions
- fix: include liquidation strategy explanation
- visuals: update flashloan execution section
- update: add constructor details with deployment args
- visuals: refactor core functions for clarity
- hotfix: update flashloan execution section
- docs: refactor core functions for clarity
- update: improve Mermaid flowchart references
- visuals: include liquidation strategy explanation
- update: include XOR-based AuxLog explanation
- visuals: fix swap function descriptions
- fix: include XOR-based AuxLog explanation
- refactor: include liquidation strategy explanation
- visuals: adjust Arbitrum vs L1 network notes
- hotfix: refresh deployment script instructions
- refactor: update flashloan execution section
- visuals: refresh deployment script instructions
- oops: update flashloan execution section
- feat: fix swap function descriptions
- chore: enhance features and security considerations
- visuals: refactor core functions for clarity
- feat: refactor core functions for clarity
- oops: refresh deployment script instructions
- update: add .env and private key setup guide
- refactor: include liquidation strategy explanation
- refactor: refactor core functions for clarity
- refactor: add .env and private key setup guide
- fix: fix swap function descriptions
- refactor: update flashloan execution section
- feat: enhance features and security considerations
- hotfix: include liquidation strategy explanation
- visuals: enhance features and security considerations
- hotfix: clarify safety and helper functions
- chore: improve Mermaid flowchart references
- visuals: refresh deployment script instructions
- update: include liquidation strategy explanation
- update: refresh deployment script instructions
- chore: include XOR-based AuxLog explanation
- fix: update flashloan execution section
- refactor: update recommended usage instructions
- refactor: fix swap function descriptions
- visuals: adjust Arbitrum vs L1 network notes
- fix: refresh deployment script instructions
- refactor: clarify safety and helper functions
- refactor: refactor core functions for clarity
- refactor: fix typos and formatting in tables
- feat: add profit handling workflow
- visuals: refresh deployment script instructions
- docs: add constructor details with deployment args
- visuals: update flashloan execution section
- hotfix: refresh deployment script instructions
- hotfix: enhance features and security considerations
- chore: enhance features and security considerations
- visuals: fix typos and formatting in tables
- docs: fix swap function descriptions
- visuals: include liquidation strategy explanation
- refactor: improve Mermaid flowchart references
- update: improve Mermaid flowchart references
- fix: include liquidation strategy explanation
- feat: fix swap function descriptions
- chore: update flashloan execution section
- docs: include liquidation strategy explanation
- hotfix: refactor core functions for clarity
- fix: clarify safety and helper functions
- oops: update flashloan execution section
- refactor: fix typos and formatting in tables
- fix: add constructor details with deployment args
- refactor: add profit handling workflow
- chore: add profit handling workflow
- fix: fix typos and formatting in tables
- update: refactor core functions for clarity
- update: update recommended usage instructions
- update: improve Mermaid flowchart references
- chore: enhance features and security considerations
- hotfix: refresh deployment script instructions
- visuals: refactor core functions for clarity
- update: improve Mermaid flowchart references
- refactor: adjust Arbitrum vs L1 network notes
- feat: refactor core functions for clarity
- docs: include XOR-based AuxLog explanation
- docs: fix swap function descriptions
- feat: update flashloan execution section
- docs: update flashloan execution section
- chore: update flashloan execution section
- update: update flashloan execution section
- refactor: refresh deployment script instructions
- visuals: refresh deployment script instructions
- oops: adjust Arbitrum vs L1 network notes
- fix: refactor core functions for clarity
- docs: include liquidation strategy explanation
- oops: include XOR-based AuxLog explanation
- chore: add constructor details with deployment args
- visuals: refactor core functions for clarity
- hotfix: include liquidation strategy explanation
- feat: refresh deployment script instructions
- hotfix: add constructor details with deployment args
- update: include liquidation strategy explanation
- feat: refresh deployment script instructions
- chore: include liquidation strategy explanation
- refactor: include liquidation strategy explanation
- oops: add .env and private key setup guide
- fix: refactor core functions for clarity
- refactor: add profit handling workflow
- feat: update recommended usage instructions
- fix: refactor core functions for clarity
- docs: update flashloan execution section
- feat: add profit handling workflow
- hotfix: fix typos and formatting in tables
- visuals: update recommended usage instructions
- refactor: update flashloan execution section
- update: enhance features and security considerations
- chore: include liquidation strategy explanation
- feat: update flashloan execution section
- fix: update flashloan execution section
- docs: fix typos and formatting in tables
- docs: include XOR-based AuxLog explanation
- visuals: update flashloan execution section
- visuals: update flashloan execution section
- chore: refactor core functions for clarity
- docs: refresh deployment script instructions
- oops: fix typos and formatting in tables
- fix: adjust Arbitrum vs L1 network notes
- chore: adjust Arbitrum vs L1 network notes
- fix: include liquidation strategy explanation
- visuals: refresh deployment script instructions
- feat: clarify safety and helper functions
- fix: update recommended usage instructions
