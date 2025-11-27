# Wallet Swap Assistant 💱

A Web3 token swap assistant built on Ethereum Sepolia testnet.

**🔗 Live Demo:** [wallet-swap-assistant.vercel.app](https://wallet-swap-assistant.vercel.app)

> Connect your wallet → Get a quote on Sepolia testnet (no real funds needed)

---

## ✨ Features

- 🔐 Wallet connection via RainbowKit
- 💱 Token swap quotes (DAI, WETH, USDC)
- ✅ ERC-20 allowance checking
- 📊 PostHog analytics integration

---

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/Julia759/wallet-swap-assistant.git
cd wallet-swap-assistant

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Add your NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID and NEXT_PUBLIC_POSTHOG_KEY

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠 Tech Stack

- **Framework:** Next.js 16
- **Wallet:** RainbowKit + wagmi
- **Blockchain:** Ethereum (Sepolia testnet)
- **Styling:** Tailwind CSS
- **Analytics:** PostHog
- **Deployment:** Vercel

---

## 📄 License

MIT
