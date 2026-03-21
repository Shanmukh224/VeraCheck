module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { content } = req.body || {};
  if (!content || content.trim().length < 5) return res.status(400).json({ error: "No content provided." });
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return res.status(500).json({ error: "API key not configured." });

  const prompt = `Analyze this news claim. Reply ONLY with raw JSON, no markdown, no extra text.

CLAIM: ${content.slice(0, 2000)}

JSON format:
{"verdict":"REAL","confidence":80,"title":"Short verdict","subtitle":"One sentence.","summary":"Two sentences about the claim and findings.","findings":"• Finding one\n• Finding two\n• Finding three","indicators":[{"label":"Sources verified","type":"positive"},{"label":"Consistent reporting","type":"positive"},{"label":"Some uncertainty","type":"neutral"}],"sources":["Reuters","BBC News","AP News"]}

verdict = REAL, FAKE, or UNCERTAIN only.`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(502).json({ error: data.error?.message || "Gemini error" });
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = raw.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: "Could not parse response." });
    return res.status(200).json(JSON.parse(match[0]));

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
