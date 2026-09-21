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

// Live Weather API route
app.get('/api/weather', async (req, res) => {
  try {
    delete require.cache[require.resolve('./api/weather.js')];
    const handler = require('./api/weather.js');
    await handler(req, res);
  } catch (err) {
    console.error("Error in weather handler:", err);
    res.status(500).json({ error: err.message || "Failed to fetch weather" });
  }
});

// DevOps Health Check endpoint (for Docker & Jenkins smoke tests)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// System Observability & DevOps Metrics endpoint
app.get('/api/metrics', async (req, res) => {
  try {
    delete require.cache[require.resolve('./api/metrics.js')];
    const handler = require('./api/metrics.js');
    await handler(req, res);
  } catch (err) {
    console.error("Error in metrics handler:", err);
    res.status(500).json({ error: err.message || "Failed to retrieve metrics" });
  }
});

// News Article URL Scraper endpoint
app.post('/api/scrape', async (req, res) => {
  try {
    delete require.cache[require.resolve('./api/scrape.js')];
    const handler = require('./api/scrape.js');
    await handler(req, res);
  } catch (err) {
    console.error("Error in scrape handler:", err);
    res.status(500).json({ error: err.message || "Failed to scrape URL" });
  }
});

// Fallback to serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`VeraCheck running locally at http://localhost:${PORT}`);
});
