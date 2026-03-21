module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { content } = req.body || {};
  if (!content || content.trim().length < 5) return res.status(400).json({ error: "No content provided." });
  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) return res.status(500).json({ error: "API key not configured." });

  const prompt = `You are a fake news detection AI. Analyze this news claim carefully and respond ONLY with raw JSON, absolutely no markdown, no extra text, just the JSON object.

CLAIM: ${content.slice(0, 2000)}

Respond with exactly this JSON:
{"verdict":"REAL","confidence":80,"title":"Short verdict phrase","subtitle":"One sentence explanation.","summary":"Two to three sentences about the claim and your findings.","findings":"• Finding one\n• Finding two\n• Finding three","indicators":[{"label":"Credible sources found","type":"positive"},{"label":"Consistent reporting","type":"positive"},{"label":"Minor uncertainty","type":"neutral"}],"sources":["Reuters","BBC News","AP News"]}

Rules: verdict must be REAL, FAKE, or UNCERTAIN. Replace all example values with your real analysis.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + KEY
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 800
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: data.error?.message || "Groq API error" });

    const raw = data.choices?.[0]?.message?.content || "";
    const match = raw.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: "Could not parse response." });
    return res.status(200).json(JSON.parse(match[0]));

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
