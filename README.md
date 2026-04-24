# VeraCheck — AI-Powered Fake News Detector

> Paste any news headline or article. VeraCheck searches the web in real time and gives you an instant AI-powered verdict.

**Live Demo:** [veracheck.vercel.app](https://veracheck.vercel.app)

---

## What is VeraCheck?

VeraCheck is a free, open-source web application that uses artificial intelligence to detect fake news. It combines live Google Search with a powerful large language model to analyze any news claim and classify it as **REAL**, **FAKE**, or **UNCERTAIN** — all in under 8 seconds, with no signup required.

---

## Features

- **AI-Powered Analysis** — Uses Meta's Llama 3.3 70B model via Groq API
- **Live Web Search** — Searches Google in real time via Serper API for up-to-date evidence
- **Instant Verdict** — Returns REAL / FAKE / UNCERTAIN with a confidence score
- **Key Findings** — Shows bullet-point findings from the analysis
- **Source References** — Lists credible sources consulted during analysis
- **Credibility Indicators** — Visual tags showing positive, negative and neutral signals
- **Analysis History** — Saves past checks in browser with individual delete support
- **Copy Result** — Copy the full verdict to clipboard in one click
- **Mobile Friendly** — Fully responsive design that works on all devices
- **No Login Required** — Completely free, open to anyone with the link
- **Smooth Animations** — Logo splash screen, scroll reveal, magnetic button effects

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js (Vercel Serverless Function) |
| AI Model | Llama 3.3 70B via Groq API |
| Web Search | Serper API (Google Search) |
| Hosting | Vercel (Free Tier) |
| Version Control | GitHub |
| Storage | Browser localStorage |

---

## System Architecture

```
User Browser
     │
     ▼
index.html  ──────────────────────────────────┐
(Frontend)                                     │
     │  POST /api/analyze                      │
     ▼                                         │
api/analyze.js                                 │
(Vercel Serverless Function)                   │
     │                    │                    │
     ▼                    ▼                    │
Serper API           Groq API                  │
(Google Search)   (Llama 3.3 70B)             │
     │                    │                    │
     └──── JSON Verdict ──┘                    │
                │                              │
                ▼                              │
     Frontend renders result ◄────────────────┘
```

---

## Project Structure

```
veracheck/
├── index.html          # Frontend — UI, CSS animations, JavaScript logic
├── api/
│   └── analyze.js      # Backend — Serverless function handling AI + search
├── vercel.json         # Vercel routing configuration
└── README.md           # Project documentation
```

---

## How It Works

**Step 1 — User Input**
The user pastes a news article or headline into the text area and clicks *Check Now*.

**Step 2 — Web Search**
The backend calls the Serper API with the claim as a query. It retrieves the top 5 live Google Search results related to the claim.

**Step 3 — AI Analysis**
The original claim and the search results are combined into a structured prompt and sent to the Groq API running Llama 3.3 70B. The model analyzes the evidence and reasons about the claim's validity.

**Step 4 — Verdict Generation**
The AI returns a structured JSON response containing the verdict, confidence score, summary, key findings, credibility indicators, and sources.

**Step 5 — Result Display**
The frontend renders the result card with smooth animations, saves the check to history, and allows the user to copy the result.

---

## Getting Started

### Prerequisites
- Node.js v20 or above
- A free [Groq API key](https://console.groq.com)
- A free [Serper API key](https://serper.dev)
- A free [Vercel account](https://vercel.com)

### Local Development

**1. Clone the repository**
```bash
git clone https://github.com/Shanmukh224/veracheck.git
cd veracheck
```

**2. Install dependencies**
```bash
npm install express dotenv
```

**3. Create a `.env` file**
```env
GROQ_API_KEY=your_groq_api_key_here
SERPER_API_KEY=your_serper_api_key_here
```

**4. Create a local server file `server.js`**
```js
const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.post('/api/analyze', async (req, res) => {
  const handler = require('./api/analyze.js');
  return handler(req, res);
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(3000, () => console.log('Running at http://localhost:3000'));
```

**5. Run the project**
```bash
node server.js
```

**6. Open in browser**
```
http://localhost:3000
```

---

## Deployment on Vercel

**Step 1** — Push your code to GitHub

**Step 2** — Go to [vercel.com](https://vercel.com) → Import your GitHub repository

**Step 3** — Add Environment Variables in Vercel Settings:
```
GROQ_API_KEY = your_groq_key
SERPER_API_KEY = your_serper_key
```

**Step 4** — Click Deploy → Your site is live at `your-project.vercel.app`

---

## API Reference

### POST `/api/analyze`

**Request Body**
```json
{
  "content": "News article or headline text here"
}
```

**Response**
```json
{
  "verdict": "REAL",
  "confidence": 87,
  "title": "Claim Verified True",
  "subtitle": "Multiple credible sources confirm this claim.",
  "summary": "The claim has been verified by Reuters and BBC News...",
  "findings": "• Finding one\n• Finding two\n• Finding three",
  "indicators": [
    { "label": "Multiple sources confirm", "type": "positive" },
    { "label": "Consistent reporting", "type": "positive" },
    { "label": "Minor uncertainty", "type": "neutral" }
  ],
  "sources": ["Reuters", "BBC News", "AP News"]
}
```

**Verdict Values**
| Value | Meaning |
|---|---|
| `REAL` | Claim is confirmed by credible sources |
| `FAKE` | Claim is contradicted or debunked |
| `UNCERTAIN` | Evidence is mixed or insufficient |

---

## Limitations

- Not effective for breaking news less than a few hours old
- Cannot verify images, videos or audio content
- Accuracy depends on available online sources for the claim
- Should be used as a first-line check, not a final authority
- Not a substitute for professional journalism or fact-checking

---

## Future Improvements

- Add Twitter/X and Reddit as additional search sources
- Implement source credibility scoring system
- Add image and video verification using reverse search APIs
- User feedback loop to flag incorrect verdicts
- Multi-language support for non-English news
- Browser extension version for instant checking while browsing

---

## Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the **MIT License** — free to use, modify and distribute.

---

## Acknowledgements

- [Groq](https://groq.com) — for providing free access to Llama 3.3 70B
- [Meta AI](https://ai.meta.com) — for the open-source Llama 3.3 model
- [Serper](https://serper.dev) — for the Google Search API
- [Vercel](https://vercel.com) — for free serverless hosting

---

## Author

**Shanmukh** — Built with curiosity and a lot of debugging 🚀

---

*VeraCheck — Because truth matters.*
