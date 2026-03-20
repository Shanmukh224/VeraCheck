# TruthLens — AI Fake News Detector
### Deploy in 5 minutes. Free. No user sign-up needed.

---

## What's in this folder

```
truthlens/
├── public/
│   └── index.html       ← The website frontend
├── api/
│   └── analyze.js       ← Serverless backend (hides your API key)
├── vercel.json          ← Vercel routing config
├── package.json         ← Node config
└── README.md            ← This file
```

---

## Step 1 — Get a free Gemini API Key

1. Go to → https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key (looks like `AIzaSy...`)

---

## Step 2 — Deploy to Vercel (free)

### Option A: Via GitHub (easiest, recommended)

1. Create a free account at https://github.com
2. Create a new repository (click + → New repository)
3. Upload all files in this folder to the repository
4. Go to https://vercel.com and sign up free (use your GitHub account)
5. Click **"Add New Project"** → Import your GitHub repository
6. Click **Deploy** (leave all settings as default)

### Option B: Via Vercel CLI

```bash
npm install -g vercel
cd truthlens
vercel
```

---

## Step 3 — Add your Gemini API Key to Vercel

This is the most important step — it keeps your key secret.

1. In Vercel dashboard, open your project
2. Go to **Settings** → **Environment Variables**
3. Click **Add New**
4. Name:  `GEMINI_API_KEY`
5. Value: paste your key from Step 1
6. Click **Save**
7. Go to **Deployments** → click the 3 dots on your latest deploy → **Redeploy**

---

## Step 4 — Done! 🎉

Your site is now live at a URL like:
`https://truthlens-yourname.vercel.app`

Share it with anyone — they can use it instantly with **no sign-up, no API key prompt**.

---

## Notes

- The API key is stored securely in Vercel's environment — never visible to users
- Gemini 2.0 Flash free tier gives 1,500 requests/day — plenty for personal use
- For higher traffic, upgrade your Gemini plan at aistudio.google.com
