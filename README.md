<div align="center">

  <img src="assets/icons/icon128.png" alt="LeetCode Companion Logo" width="80" height="80" />

  # LeetCode Companion

  ### Never Lose Your Streak Again — Auto-Solve Protection, AI-Powered Hints, and Seamless GitHub Sync.

  <p>
    <a href="https://chrome.google.com/webstore"><img src="https://img.shields.io/badge/Chrome_Web_Store-v1.0.0-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Web Store" /></a>
    <a href="https://developer.chrome.com/docs/extensions/mv3/"><img src="https://img.shields.io/badge/Manifest-V3-34A853?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-A855F7?style=for-the-badge" alt="License" /></a>
    <a href="https://github.com/Satyam810/leetcode-companion/pulls"><img src="https://img.shields.io/badge/PRs-Welcome-10B981?style=for-the-badge" alt="PRs Welcome" /></a>
  </p>

  <p>
    🛡️ <strong>Auto-Solve Streak Protection</strong> &nbsp;·&nbsp; 🤖 <strong>AI-Powered Learning</strong> &nbsp;·&nbsp; 🔄 <strong>Automatic GitHub Sync</strong> &nbsp;·&nbsp; 📊 <strong>Progress Dashboard</strong>
  </p>

  <br />

  <img src="assets/screenshots/hero-banner.png" alt="LeetCode Companion Preview" width="680" style="border-radius: 12px; box-shadow: 0 4px 30px rgba(0,0,0,0.15);" />

</div>

<br />

---

## 🎯 The Problem

You've been grinding LeetCode for **47 days straight**. You have a meeting, an exam, a deadline — and by the time you remember, it's midnight. **Streak gone. 47 days wasted.**

Or maybe you solved a problem, but forgot to save the code. Now it's lost in LeetCode's submission history. No GitHub profile contribution. No portfolio to show for your hard work.

**LeetCode Companion solves all of this — automatically.**

<br />

## 💡 What Makes This Different?

Most extensions only push your code to a repo. That's it. LeetCode Companion is a **complete AI-powered companion** that:

<table>
  <tr>
    <td align="center" width="33%">
      <h3>🛡️ Protects</h3>
      <p>Auto-solves the daily challenge when you can't, so your streak <b>never breaks</b>.</p>
    </td>
    <td align="center" width="33%">
      <h3>🧠 Teaches</h3>
      <p>AI explains problems step-by-step in a beautiful floating sidebar so you actually <b>learn</b>.</p>
    </td>
    <td align="center" width="33%">
      <h3>🔄 Records</h3>
      <p>Every solution auto-syncs to GitHub, building your <b>coding portfolio</b>.</p>
    </td>
  </tr>
</table>

> [!NOTE]
> **One extension. Three superpowers. Zero effort.**

<br />

---

## ✨ Features

### 🛡️ 1. Streak Protection (Auto-Solve)
*Set a time. Forget about it. Your streak is safe forever.*

LeetCode resets the daily challenge at midnight UTC. If life gets in the way and you can't solve it, LeetCode Companion has your back. 

```
⏰ You set trigger time to 10:00 PM
📋 Every 60 seconds, the extension checks: "Did the user solve today's daily challenge?"
✅ If YES → Silently marks the day as done. Nothing happens.
❌ If NO and it's past 10:00 PM → Auto-solve activates:
```

#### The Auto-Solve Pipeline:
```mermaid
graph TD
    A["⏰ Trigger Time Reached"] --> B["🔍 Check LeetCode Daily Challenge Status"]
    B -->|Already Solved| C["✅ Mark Complete — Do Nothing"]
    B -->|Not Solved| D["🚀 Open Daily Challenge in New Tab"]
    D --> E["🤖 AI Generates Optimal Solution via Groq"]
    E --> F["✍️ Types Code into Monaco Editor"]
    F --> G["▶️ Clicks Submit"]
    G --> H["⏳ Waits for 'Accepted' Verdict"]
    H --> I["🔄 Auto-Syncs Solution to GitHub"]
    I --> J["🔥 Streak Protected!"]
```

> [!TIP]
> **Smart Deduplication** — If you solve the problem manually at any point during the day, the auto-solver detects it and does nothing. No duplicate submissions. No duplicate GitHub commits.

---

### 🤖 2. AI-Powered Learning Assistant
*Don't just solve problems. Understand them.*

<div align="center">
  <img src="assets/screenshots/ai-sidebar.png" alt="AI Sidebar Panel" width="600" style="border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" />
</div>

When you're stuck on a problem, click **"Help Me Solve"** to open a premium draggable panel containing:

- **🎯 Step-by-Step Approach**: Breaks down the problem into digestible steps and identifies the underlying pattern (Two Pointers, DP, Graph, etc.).
- **💬 Interactive Follow-Up Chat**: Ask follow-up questions in natural language, request optimizations, or clarify edge cases.
- **⚡ Supercharged Speed**: Powered by **Groq LLaMA 3.3 70B** for near-instant responses.

---

### 🔄 3. Intelligent GitHub Sync
*Every problem you solve automatically becomes a GitHub contribution.*

<div align="center">
  <img src="assets/screenshots/github-sync.png" alt="GitHub Sync Workflow" width="600" style="border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" />
</div>

Every synced solution is enriched and organized with clean file headers containing the problem description, difficulty level, and code formatted in comments matching the target language.

#### Clean Repository Structure:
```
📂 leetcode-solutions/
│
├── 📂 two-sum/
│   └── 📄 solution.py              ← includes full problem description
│
├── 📂 valid-parentheses/
│   └── 📄 solution.js              ← with JSDoc-style problem header
│
└── ... (auto-organized by problem slug)
```

---

### 📊 4. Progress Dashboard & Premium UI/UX
*Built with the polish of a premium SaaS product.*

- **Dashboard**: A beautiful, glassmorphic layout displaying your solved problem counts by difficulty, current streak, and connection status.
- **Draggable Floating Sidebar**: Toggled from the popup, this sidebar can be dragged anywhere on your screen or snapped magnetically to the edges.
- **Real-Time Sync**: Change settings in the popup, and the page sidebar updates instantly (and vice-versa).

<br />

---

## 🚀 Installation

### Option 1: Load from Source (Recommended for Devs)

```bash
# 1. Clone the repository
git clone https://github.com/Satyam810/leetcode-companion.git
cd leetcode-companion

# 2. Load in Chrome:
#    -> Open chrome://extensions
#    -> Enable "Developer mode" (top-right toggle)
#    -> Click "Load unpacked"
#    -> Select the cloned project folder
```

---

## ⚙️ Setup Guide

### Step 1: Get Your Free Groq AI Key
1. Go to **[console.groq.com](https://console.groq.com)** and sign up *(completely free)*.
2. Navigate to **API Keys** → **Create API Key** and copy it.

### Step 2: Create a GitHub Personal Access Token
1. Go to **[GitHub → Settings → Developer Settings → Tokens (classic)](https://github.com/settings/tokens)**.
2. Click **Generate new token (classic)** and select the **`repo`** scope.

### Step 3: Configure the Extension
1. Click the **LeetCode Companion** icon in your toolbar.
2. Open the **⚙️ Settings** page and fill in your credentials:
   - **GitHub Repo**: In `username/repo` format (e.g. `Satyam810/leetcode-solutions`).
   - **Groq API Key**: `gsk_...`
3. Click **Save Settings** & **Test Connection** to verify both are connected!

<br />

---

## 🏗️ Architecture

```
leetcode-companion/
│
├── manifest.json                    # Chrome Extension Manifest V3
├── LICENSE                          # MIT License
│
├── 📂 assets/
│   ├── 📂 icons/                    # Extension icons
│   └── 📂 screenshots/             # README screenshots
│
└── 📂 src/
    ├── 📂 background/
    │   └── service-worker.js        # Background Service Worker (Streak monitoring & API routing)
    │
    ├── 📂 content/
    │   ├── detector.js              # Observes DOM for "Accepted" submissions
    │   ├── injector.js              # Injects premium floating sidebar and dashboard UI
    │   └── editor-injector.js       # Bridge to Monaco editor (types AI solutions)
    │
    ├── 📂 lib/
    │   ├── groq-api.js              # Groq API Wrapper with auto-fallback models
    │   ├── github-api.js            # GitHub REST API client
    │   └── storage.js               # Chrome storage helpers (real-time sync)
    │
    └── 📂 popup/
        ├── popup.html / popup.js    # Popup Dashboard
        └── settings.html / settings.js  # SaaS-grade settings panel
```

<br />

---

## 🔐 Privacy & Security

We take your privacy seriously. **All logic runs locally on your browser.**
- **API Keys**: Stored in Chrome's encrypted `storage.sync`.
- **Your Code**: Sent directly to Groq (for AI help) and GitHub (for sync) — never through any third-party server.
- **Zero Tracking**: No telemetry, no analytics, no third-party scripts.

<br />

---

## 👨‍💻 Author

<div align="center">

**Built with ❤️ by Satyam**

[![GitHub](https://img.shields.io/badge/GitHub-Satyam810-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Satyam810)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Satyam-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/satyamlpu/)
[![Medium](https://img.shields.io/badge/Medium-@satyamvatsa810-000000?style=for-the-badge&logo=medium&logoColor=white)](https://medium.com/@satyamvatsa810)
[![Portfolio](https://img.shields.io/badge/Portfolio-satyam--portfoli-8B5CF6?style=for-the-badge&logo=vercel&logoColor=white)](https://satyam-portfoli.vercel.app/)

</div>

<br />

---

<div align="center">

### 🌟 Show your support by starring the repository!
<sub>Made with ⚡ by <a href="https://github.com/Satyam810">Satyam</a></sub>

</div>
