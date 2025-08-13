# 📚 Documentation

Welcome to the **MEV-Searcher Lab MEV Knowledge Hub** — where theory meets **on-chain conquest**.

> **Status:** 🚧 *This knowledge hub is still being scaffolded. Only fully audited strategies are live. Pending items are marked as “Awaiting Audit.”*

---

## ✅ Audited & Approved Strategies

### **Post-Sequencer MEV**
How to capture profit after the sequencer but before public mempool exposure. (Arbitrum Mainnet Dominant)
*(Full guide: [`post_sequencer_mev.md`](./post_sequencer_mev.md))*

### **Liquidation Strategy Details**
Precision plays for liquidating unsafe positions at lightning speed.  
*(Full guide: [`liquidation_strategy.md`](./liquidation_strategy.md))*

### **ROI Modeling & Gas Funding**
probablistic ROI%, Gas Usage & Aggression mode formula, detailing factor that impact ROI and Event of Impact(EOI)
*(Full guide: [`roi_math.md`](./roi_math.md))*

---

## 🚧 Pending Audit

- **Aggressive Brute-Force Setup**  
  *Awaiting audit — will cover configurations to push transaction throughput to the limits.*
  
- **ROI Modeling & Gas Funding**  
  *Awaiting audit — will break down the math for sustainable scaling.*

- **Core Profit Cycle Scripts**  
  *Includes `scripts/deploy.js` and `scripts/control.js` — essential for deploying and controlling the MevBotExecutor.*  
  **PnL Logic:** Profit = execute, Loss = revert with rich revert data.  
  These scripts form the operational heartbeat of the bot; pending audit for safety and robustness.

---

## 🗂 Document Structure

```

/docs
├── post\_sequencer\_mev.md
├── liquidation\_strategy.md
├── roi\_math.md  
├── brute\_force\_setup.md       # 🚧 Awaiting Audit
|-- profit\-lifecycle.md             # 🚧 Awaiting Audit

````

---

## 📊 Concept Flow — **Top-Down (TD)**

```mermaid
flowchart TD
    A[MEV Opportunity Detected] --> B[Pathfinding & Strategy Selection]
    B --> C[Simulation & Profit Check]
    C --> D{ROI Positive?}
    D -->|No| E[Discard / Re-scan]
    D -->|Yes| F[Bundle Construction]
    F --> G[Flashbots / Direct Sequencer Submission]
    G --> H[Execution & Settlement]
    H --> I[Profit Collection]
    
    %% Mark pending strategies faded
    style F fill:#ccc,stroke:#999,stroke-dasharray: 5 5
````

---

## 📊 Concept Flow — **Left-to-Right (LR)**

```mermaid
flowchart LR
    A[Scan & Detect] --> B[Select Strategy] --> C[Simulate]
    C --> D{Profitable?}
    D -->|No| E[Skip]
    D -->|Yes| F[Build Bundle]
    F --> G[Submit to Sequencer]
    G --> H[Execute]
    H --> I[Collect Profit]
    
    %% Fade pending items
    style F fill:#ccc,stroke:#999,stroke-dasharray: 5 5
```

---

## 💡 How to Use These Docs

1. **Start with `post_sequencer_mev.md`** — understand the battleground.
2. Move to **`liquidation_strategy.md`** — master the fastest kill strikes.
3. next --> **`roi\_math.md`** - get the ROI probablistic %, Gas usage & Event of Impact
3. 🚧 *Pending Audit*: `brute_force_setup.md`
4. 🚧 *Pending Audit*: `profit-lifecycle.md`

📌 **Pro Tip:** Keep the diagrams open side-by-side with the text — visual context accelerates mastery.

---

> *"MEV isn’t just about finding profit — it’s about **taking** it before anyone else even knows it exists."*
> — MEV Searcher Lab

```
