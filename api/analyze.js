module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { content } = req.body || {};
  if (!content || content.trim().length < 5) {
    return res.status(400).json({ error: "No content provided." });
  }

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) {
    return res.status(500).json({ error: "API key not configured on server." });
  }

  const prompt = `You are a fake news detection AI. Analyze this claim and respond ONLY with raw JSON, no markdown, no extra text:

CLAIM: ${content.slice(0, 3000)}

Respond with exactly this JSON structure:
{
  "verdict": "REAL",
  "confidence": 85,
  "title": "Claim is Verified",
  "subtitle": "One sentence explanation here.",
  "summary": "Two to three sentence summary of the claim and findings.",
  "findings": "• Finding one\n• Finding two\n• Finding three",
  "indicators": [
    {"label": "Credible sources found", "type": "positive"},
    {"label": "Consistent reporting", "type": "positive"},
    {"label": "No contradictions", "type": "neutral"}
  ],
  "sources": ["Reuters", "BBC News", "AP News"]
}

Use verdict REAL if confirmed, FAKE if debunked, UNCERTAIN if unclear. Replace all values with your actual analysis.`;

  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + KEY;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000
        }
      })
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(502).json({
        error: data.error?.message || "Gemini API error"
      });
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (!match) {
      return res.status(502).json({ error: "Could not parse AI response." });
    }

    const result = JSON.parse(match[0]);
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
};
