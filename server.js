const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// API Route mapping
app.post('/api/analyze', async (req, res) => {
  try {
    delete require.cache[require.resolve('./api/analyze.js')];
    const handler = require('./api/analyze.js');
    await handler(req, res);
  } catch (err) {
    console.error("Error in handler:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// Serve Firebase config securely to the frontend
app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || ""
  });
});

// Fallback to serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`VeraCheck running locally at http://localhost:${PORT}`);
});
