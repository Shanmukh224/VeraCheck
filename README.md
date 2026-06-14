# VeraCheck — AI-Powered Fake News Detector

> Paste any news headline or article. VeraCheck searches the web in real time, extracts key claims, and provides instant, AI-powered fact-checking verdicts along with rich analytics.

**Live Demo:** [veracheck.vercel.app](https://veracheck.vercel.app)

---

## What is VeraCheck?

VeraCheck is a web application that uses artificial intelligence to detect misinformation and fake news. It combines live Google Search with a powerful large language model to analyze news claims and classify them as **REAL**, **FAKE**, or **UNCERTAIN** — all in under 8 seconds. 

The platform features comprehensive credibility metrics, claim extraction, community voting, an interactive educational quiz, and a live explore feed of trending checks.

---

## Features

- **AI-Powered Analysis** — Uses Meta's Llama 3.3 70B model via Groq API to analyze claims and draft detailed verdicts.
- **Live Web Search** — Searches Google in real time via Serper API to gather recent articles and source evidence.
- **Multi-Claim Extraction** — Analyzes long-form articles, automatically extracts 3-5 verifiable claims, and allows you to fact-check each claim individually.
- **Global Trends Feed** — Community dashboard powered by Firebase Firestore displaying recent verified claims, filterable by category and searchable.
- **Consensus & Social Buzz** — Deep-dive analytics detailing:
  - **Source Consensus Score** (how unified reports are).
  - **Evidence Strength** (amount/quality of references).
  - **Media Bias Breakdown** (Left, Center, Right distribution).
  - **Social Buzz** (Velocity, platforms active, and overall sentiment).
- **Community Consensus Voting** — Registered users can vote on whether they agree or disagree with the AI verdict, keeping track of community consensus.
- **Interactive Educational Quiz** — Generates a randomized 5-question news quiz focusing on various modern themes (AI, Crypto, Space, Deepfakes) to test and train your fake news detection skills.
- **Secure Authentication** — Firebase Auth integration supporting one-click Google Sign-In and SMS Phone OTP verification.
- **Source References & Credibility Indicators** — Interactive references with original links and visual tags highlighting factual consistency or warning signs.
- **Local History** — Automatically saves your recent checks in the browser with individual delete capabilities.
- **Copy Result** — Copy structured markdown results to your clipboard instantly.
- **Responsive Layout & Animations** — Features a premium glassmorphic UI with smooth scroll transitions, page load animations, and dynamic state switching.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3 (Vanilla Glassmorphism), JavaScript (ES6 Modules) |
| **Backend** | Node.js (Vercel Serverless Functions / Express) |
| **Database** | Firebase Firestore (Real-time global trends & voting system) |
| **Authentication** | Firebase Auth (Google OAuth, Phone OTP) |
| **AI Processing** | Llama 3.3 70B via Groq API (`llama-3.3-70b-versatile`) |
| **Web Search** | Serper API (Google Search integration) |
| **Hosting** | Vercel |

---

## System Architecture

```
User Browser
     │
     ├───────────────────────► Firebase Firestore & Auth (OAuth / DB Read & Write)
     │
     ▼  POST /api/analyze (Or /api/firebase-config)
api/analyze.js
(Vercel Serverless Function)
     │                    │
     ▼                    ▼
Serper API           Groq API
(Google Search)   (Llama 3.3 70B)
     │                    │
     └──── JSON Verdict ──┘
                │
                ▼
     Frontend renders result
```

---

## Project Structure

```
veracheck/
├── index.html                  # Frontend — UI layout, CSS styles, SPA script
├── api/
│   ├── analyze.js              # Serverless Function: Claims extraction, Quiz, and Analyze
│   └── firebase-config.js      # Serverless Function: Securely serves Firebase config
├── vercel.json                 # Vercel configuration for serverless rewrites
├── package.json                # Project dependencies and startup scripts
├── server.js                   # Express server for local development
└── README.md                   # Documentation
```

---

## Getting Started

### Prerequisites
- Node.js v20 or above
- A free [Groq API key](https://console.groq.com)
- A free [Serper API key](https://serper.dev)
- A Firebase project (Firestore and Authentication enabled)

### Local Development

**1. Clone the repository**
```bash
git clone https://github.com/Shanmukh224/VeraCheck.git
cd VeraCheck
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure Environment Variables**
Create a `.env` file in the root directory:
```env
# Groq and Serper API Keys
GROQ_API_KEY=your_groq_api_key
SERPER_API_KEY=your_serper_api_key

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_APP_ID=your_app_id
```

**4. Run the local server**
```bash
npm start
```
*Alternatively, if you have Vercel CLI installed:*
```bash
npm run dev
```

**5. Open in browser**
Navigate to `http://localhost:3000` (or `http://localhost:5000` for vercel dev) in your web browser.

---

## API Reference

### POST `/api/analyze`

#### 1. Claim Verification (Default)
**Request Body:**
```json
{
  "action": "analyze",
  "content": "Headline or claim to analyze",
  "language": "English"
}
```

#### 2. Claim Extraction
**Request Body:**
```json
{
  "action": "extract",
  "content": "Long news article text...",
  "language": "English"
}
```

#### 3. Educational Quiz Generation
**Request Body:**
```json
{
  "action": "quiz",
  "language": "English"
}
```

---

## Authors & License

- **Shanmukh** — Lead Developer 🚀
- Distributed under the **MIT License**. Feel free to use, modify, and distribute!
