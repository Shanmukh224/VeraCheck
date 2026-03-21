module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const content = body.content || "";
  if (!content || content.trim().length < 5) {
    return res.status(400).json({ error: "No content provided." });
  }

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
      searchContext = results.map(function(r, i) {
        return "Source " + (i+1) + ": " + r.title + " - " + r.snippet;
      }).join("\n\n");
    } catch (e) {
      searchContext = "";
    }
  }

  const prompt = [
    'You are an expert fact-checker. Analyze this claim carefully.',
    '',
    'CLAIM: "' + content.slice(0, 2000) + '"',
    '',
    searchContext ? ('WEB SEARCH RESULTS:\n' + searchContext + '\n\nUse these as your PRIMARY source of truth.') : 'Use your training knowledge to analyze this claim carefully.',
    '',
    'You MUST respond with ONLY a single raw JSON object. No markdown. No backticks. No explanation. No newlines inside string values. Just the JSON:',
    '',
    '{"verdict":"REAL","confidence":85,"title":"Short verdict here","subtitle":"One sentence explanation.","summary":"Two sentence summary of claim and findings.","findings":"Finding one. Finding two. Finding three.","indicators":[{"label":"Sources verified","type":"positive"},{"label":"Consistent facts","type":"positive"},{"label":"Some uncertainty","type":"neutral"}],"sources":["Reuters","BBC News","AP News"]}',
    '',
    'STRICT RULES:',
    '- verdict must be exactly: REAL, FAKE, or UNCERTAIN',
    '- confidence is an integer 0-100',
    '- All string values must be on one line with no line breaks',
    '- No bullet points, no special characters, no Unicode symbols in strings',
    '- findings must be plain sentences separated by periods only'
  ].join('\n');

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
            content: "You are a fact-checker AI. You ONLY output raw JSON. Never use markdown, backticks, bullet symbols, or newlines inside JSON string values. Plain ASCII text only inside strings."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 700
      })
    });

    const groqData = await response.json();
    if (!response.ok) {
      return res.status(502).json({ error: groqData.error && groqData.error.message ? groqData.error.message : "Groq API error" });
    }

    let raw = groqData.choices && groqData.choices[0] && groqData.choices[0].message && groqData.choices[0].message.content ? groqData.choices[0].message.content : "";

    // Strip any markdown fences
    raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    // Extract the JSON object
    var start = raw.indexOf("{");
    var end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || start >= end) {
      return res.status(502).json({ error: "Could not parse AI response. Please try again." });
    }

    var jsonStr = raw.slice(start, end + 1);

    // Clean control characters safely (no regex char classes - mobile Safari safe)
    var cleaned = "";
    var inString = false;
    var prevChar = "";
    for (var i = 0; i < jsonStr.length; i++) {
      var ch = jsonStr[i];
      var code = jsonStr.charCodeAt(i);
      if (ch === '"' && prevChar !== '\\') inString = !inString;
      if (inString && code < 32) {
        if (code === 9) cleaned += " ";
        else if (code === 10) cleaned += " ";
        else if (code === 13) cleaned += " ";
        // skip other control chars
      } else {
        cleaned += ch;
      }
      prevChar = ch;
    }

    var result;
    try {
      result = JSON.parse(cleaned);
    } catch (parseErr) {
      return res.status(502).json({ error: "Could not parse AI response. Please try again." });
    }

    // Validate and sanitize result
    var verdict = String(result.verdict || "UNCERTAIN").toUpperCase();
    if (verdict !== "REAL" && verdict !== "FAKE") verdict = "UNCERTAIN";

    var confidence = parseInt(result.confidence, 10);
    if (isNaN(confidence) || confidence < 0) confidence = 50;
    if (confidence > 100) confidence = 100;

    // Format findings with bullet prefix for display
    var findings = String(result.findings || "");
    var sentences = findings.split(". ");
    var bulletFindings = sentences
      .filter(function(s) { return s.trim().length > 2; })
      .map(function(s) { return "\u2022 " + s.trim().replace(/\.$/, ""); })
      .join("\n");

    var clean = {
      verdict: verdict,
      confidence: confidence,
      title: String(result.title || verdict).slice(0, 80),
      subtitle: String(result.subtitle || "").slice(0, 200),
      summary: String(result.summary || "").slice(0, 500),
      findings: bulletFindings || findings,
      indicators: Array.isArray(result.indicators) ? result.indicators.slice(0, 5) : [],
      sources: Array.isArray(result.sources) ? result.sources.slice(0, 5) : []
    };

    return res.status(200).json(clean);

  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error. Please try again." });
  }
};
