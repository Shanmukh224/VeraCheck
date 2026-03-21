module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { content } = req.body || {};
  if (!content || content.trim().length < 5) return res.status(400).json({ error: "No content provided." });

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return res.status(500).json({ error: "API key not configured." });

  const models = [
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro"
  ];

  const prompt = `Analyze this news claim and respond ONLY with raw JSON, no markdown:

CLAIM: ${content.slice(0, 2000)}

Return exactly this JSON:
{"verdict":"REAL","confidence":80,"title":"Short verdict here","subtitle":"One sentence explanation.","summary":"Two sentence summary of claim and finding.","findings":"• Finding one\n• Finding two\n• Finding three","indicators":[{"label":"Sources verified","type":"positive"},{"label":"Consistent facts","type":"positive"},{"label":"Minor gaps","type":"neutral"}],"sources":["Reuters","BBC News","AP News"]}

Replace all values with real analysis. verdict must be REAL, FAKE, or UNCERTAIN.`;

  let lastError = "";

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;
      const geminiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
        })
      });

      const data = await geminiRes.json();

      if (!geminiRes.ok) {
        lastError = data.error?.message || "API error";
        continue;
      }

      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const match = raw.replace(/```json/g,"").replace(/```/g,"").trim().match(/\{[\s\S]*\}/);
      if (!match) { lastError = "Could not parse response"; continue; }

      return res.status(200).json(JSON.parse(match[0]));

    } catch (err) {
      lastError = err.message;
      continue;
    }
  }

  return res.status(502).json({ error: "All models failed: " + lastError });
};
