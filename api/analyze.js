module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { content } = req.body || {};
  if (!content || content.trim().length < 5) return res.status(400).json({ error: "No content provided." });

  const GROQ_KEY = process.env.GROQ_API_KEY;
  const SERPER_KEY = process.env.SERPER_API_KEY;
  if (!GROQ_KEY) return res.status(500).json({ error: "API key not configured." });

  // Step 1: Live web search
  let searchContext = "";
  if (SERPER_KEY) {
    try {
      const searchRes = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": SERPER_KEY },
        body: JSON.stringify({ q: content.slice(0, 200), num: 5 })
      });
      const searchData = await searchRes.json();
      const results = searchData.organic || [];
      searchContext = results.map((r, i) =>
        `Source ${i+1}: ${r.title} — ${r.snippet}`
      ).join("\n\n");
    } catch (e) {}
  }

  const prompt = `You are an expert fact-checker. Analyze this claim carefully.

CLAIM: "${content.slice(0, 2000)}"

${searchContext ? `WEB SEARCH RESULTS:\n${searchContext}\n\nUse these as your PRIMARY source of truth.` : `Use your training knowledge to analyze this claim.`}

Respond ONLY with a single valid JSON object. No markdown, no backticks, no explanation. Just the raw JSON:

{"verdict":"REAL","confidence":85,"title":"Claim is verified","subtitle":"One clear sentence explaining the verdict.","summary":"Two to three sentences explaining what the claim says and what evidence shows.","findings":"Finding one. Finding two. Finding three.","indicators":[{"label":"Multiple sources confirm","type":"positive"},{"label":"Consistent reporting","type":"positive"},{"label":"Minor gaps in evidence","type":"neutral"}],"sources":["Reuters","BBC News","AP News"]}

Rules:
- verdict must be exactly REAL, FAKE, or UNCERTAIN
- confidence is a number 0 to 100
- findings must be plain text only, no bullet characters or newlines
- All strings must use only standard ASCII characters
- Do not include any special characters or line breaks inside string values`;

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
            content: "You are a fact-checker. Always respond with only a raw JSON object. Never use markdown, backticks, bullet points, or special characters inside JSON string values. Use plain ASCII text only."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 800
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: data.error?.message || "Groq API error" });

    let raw = data.choices?.[0]?.message?.content || "";

    // Strip markdown if present
    raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    // Extract JSON object
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return res.status(502).json({ error: "Could not parse response. Please try again." });

    let jsonStr = raw.slice(start, end + 1);

    // Safe character replacement - no regex character classes (mobile Safari safe)
    let cleaned = "";
    for (let i = 0; i < jsonStr.length; i++) {
      const code = jsonStr.charCodeAt(i);
      if (code === 9) cleaned += " ";       // tab → space
      else if (code === 10) cleaned += " "; // newline → space  
      else if (code === 13) cleaned += " "; // carriage return → space
      else if (code < 32) cleaned += "";    // strip other control chars
      else cleaned += jsonStr[i];
    }

    const result = JSON.parse(cleaned);

    // Format findings as bullet points for display
    if (result.findings && typeof result.findings === "string") {
      const sentences = result.findings.split(". ").filter(s => s.trim().length > 0);
      result.findings = sentences.map(s => "• " + s.trim().replace(/\.$/, "")).join("\n");
    }

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error. Please try again." });
  }
};
