module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { content } = req.body || {};
  if (!content || content.trim().length < 5) return res.status(400).json({ error: "No content provided." });
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const SERPER_KEY = process.env.SERPER_API_KEY;
  if (!GROQ_KEY) return res.status(500).json({ error: "API key not configured." });

  // Step 1: Search the web for real-time info
  let searchContext = "";
  if (SERPER_KEY) {
    try {
      const searchRes = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": SERPER_KEY
        },
        body: JSON.stringify({ q: content.slice(0, 200), num: 5 })
      });
      const searchData = await searchRes.json();
      const results = searchData.organic || [];
      searchContext = results.map((r, i) =>
        `Source ${i+1}: ${r.title}\n${r.snippet}\nURL: ${r.link}`
      ).join("\n\n");
    } catch (e) {
      searchContext = "";
    }
  }

  const prompt = `You are an expert fact-checker and fake news detector. Analyze the following claim carefully.

CLAIM: "${content.slice(0, 2000)}"

${searchContext ? `REAL-TIME WEB SEARCH RESULTS:\n${searchContext}\n\nUse these search results as your PRIMARY source of truth.` : `Use your training knowledge to analyze this claim carefully.`}

Based on the evidence, provide your verdict. Respond ONLY with this exact JSON (no markdown, no extra text):

{"verdict":"REAL","confidence":85,"title":"Claim Verified True","subtitle":"One clear sentence explaining your verdict.","summary":"Two to three sentences explaining what the claim says and what the evidence shows.","findings":"• Key finding from evidence one\n• Key finding from evidence two\n• Key finding from evidence three","indicators":[{"label":"Multiple sources confirm","type":"positive"},{"label":"Consistent reporting","type":"positive"},{"label":"No contradicting evidence","type":"neutral"}],"sources":["Reuters","BBC News","AP News"]}

RULES:
- verdict = REAL if evidence confirms the claim
- verdict = FAKE if evidence contradicts or debunks the claim  
- verdict = UNCERTAIN if evidence is mixed or insufficient
- confidence = how sure you are (0-100)
- Be accurate and honest. Do not guess.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + GROQ_KEY
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are an expert fact-checker. You always respond with only valid JSON. Never include markdown, explanations, or text outside the JSON object."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: data.error?.message || "Groq API error" });

    const raw = data.choices?.[0]?.message?.content || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: "Could not parse response." });

    const fixedJson = match[0].replace(/[\x00-\x1F\x7F]/g, (c) => {
      if (c === '\n') return '\\n';
      if (c === '\r') return '\\r';
      if (c === '\t') return '\\t';
      return '';
    });
    return res.status(200).json(JSON.parse(fixedJson));

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
