export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  const { content } = req.body;
  if (!content || content.trim().length < 5) return res.status(400).json({ error: "No content provided." });
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "API key missing." });
  const prompt = `You are TruthLens, an expert fake news detection AI. Analyze this news content:\n\n---\n${content.slice(0,4000)}\n---\n\nSearch the web for evidence. Respond ONLY with this exact JSON (no markdown):\n{"verdict":"REAL" or "FAKE" or "UNCERTAIN","confidence":<0-100>,"title":"<3-5 word phrase>","subtitle":"<one sentence>","summary":"<2-3 sentences>","findings":"<bullet points using •>","indicators":[{"label":"<signal>","type":"positive" or "negative" or "neutral"}],"sources":["source1","source2","source3"]}`;
  try {
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], body: JSON.stringify({ 
  contents: [{ parts: [{ text: prompt }] }], 
  generationConfig: { temperature: 0.1, maxOutputTokens: 1200 } 
}) generationConfig: { temperature: 0.1, maxOutputTokens: 1200 } })
    });
    const data = await geminiRes.json();
    if (!geminiRes.ok) return res.status(502).json({ error: data.error?.message || "Gemini error" });
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = raw.replace(/```json|```/g,"").trim().match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: "Could not parse response." });
    return res.status(200).json(JSON.parse(match[0]));
  } catch(err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
