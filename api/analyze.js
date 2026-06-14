module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const action = body.action || "analyze";
  const content = body.content || "";
  const language = String(body.language || "English").trim();

  const GROQ_KEY = process.env.GROQ_API_KEY;
  const SERPER_KEY = process.env.SERPER_API_KEY;
  if (!GROQ_KEY) return res.status(500).json({ error: "API key not configured." });

  // ----------------------------------------------------
  // ACTION 1: Claims Extraction
  // ----------------------------------------------------
  if (action === "extract") {
    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: "No content provided or content is too short for claim extraction." });
    }

    const prompt = [
      'You are an expert editor. Extract the 3 to 5 main factual claims from the provided text that can be independently verified. Do not extract opinions or generic thoughts.',
      '',
      'TEXT:',
      '"' + content.slice(0, 4000) + '"',
      '',
      'You MUST respond with ONLY a single raw JSON array of strings in the ' + language + ' language. No markdown, no backticks, no explanations. Example:',
      '["Claim 1", "Claim 2", "Claim 3"]'
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
              content: "You are a claim extraction helper. You ONLY output raw JSON array of strings in " + language + ". Never use markdown or backticks."
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 400
        })
      });

      const groqData = await response.json();
      if (!response.ok) {
        return res.status(502).json({ error: groqData.error && groqData.error.message ? groqData.error.message : "Groq API error" });
      }

      let raw = groqData.choices && groqData.choices[0] && groqData.choices[0].message && groqData.choices[0].message.content ? groqData.choices[0].message.content : "";
      raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      var start = raw.indexOf("[");
      var end = raw.lastIndexOf("]");
      if (start === -1 || end === -1 || start >= end) {
        return res.status(502).json({ error: "Could not parse claim extraction response." });
      }
      var jsonStr = raw.slice(start, end + 1);
      var result = JSON.parse(jsonStr);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || "Server error in claim extraction." });
    }
  }

  // ----------------------------------------------------
  // ACTION 2: Educational Quiz
  // ----------------------------------------------------
  if (action === "quiz") {
    const quizThemes = [
      "Artificial Intelligence & Future Tech",
      "Space Exploration & Astronomy",
      "Environmental Science & Climate",
      "Health Breakthroughs & Nutrition",
      "Cryptocurrency & Global Finance",
      "Archaeological Discoveries",
      "Extreme Weather & Natural Phenomenons",
      "Gaming, Pop Culture & Cinema",
      "Deepfakes & Social Media Trends",
      "Ocean Exploration & Marine Biology",
      "Sports Science & Olympic Games",
      "Electric Vehicles & Renewable Energy"
    ];

    // Shuffle and pick 3 random themes
    const selectedThemes = quizThemes
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .join(", ");

    const randomSeed = Math.floor(Math.random() * 1000000);

    const prompt = [
      'You are an expert educator. Generate 5 unique, highly creative, and interesting news headlines (some real, some fake, some uncertain/misleading) in the following language: ' + language + '.',
      `Focus the headlines on a mix of these random themes: ${selectedThemes}.`,
      `Ensure the headlines are completely fresh, unique, and different from typical topics. (Random Seed context: ${randomSeed})`,
      'For each headline, provide the correct verdict (REAL, FAKE, or UNCERTAIN) and a short 1-2 sentence explanation of why.',
      '',
      'You MUST respond with ONLY a single raw JSON array of objects. No markdown. No backticks. No explanation. Just the JSON:',
      '[',
      '  {"headline": "Headline 1", "verdict": "REAL", "explanation": "Explanation 1"},',
      '  {"headline": "Headline 2", "verdict": "FAKE", "explanation": "Explanation 2"}',
      ']',
      '',
      'STRICT RULES:',
      '- The JSON keys (headline, verdict, explanation) must remain in English.',
      '- verdict must be exactly: REAL, FAKE, or UNCERTAIN',
      '- The headline and explanation values must be translated and written in ' + language + '.'
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
              content: "You are a quiz generator. You ONLY output raw JSON. Never use markdown, backticks, or explanation. Plain UTF-8 JSON only."
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 1000
        })
      });

      const groqData = await response.json();
      if (!response.ok) {
        return res.status(502).json({ error: groqData.error && groqData.error.message ? groqData.error.message : "Groq API error" });
      }

      let raw = groqData.choices && groqData.choices[0] && groqData.choices[0].message && groqData.choices[0].message.content ? groqData.choices[0].message.content : "";
      raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      var start = raw.indexOf("[");
      var end = raw.lastIndexOf("]");
      if (start === -1 || end === -1 || start >= end) {
        return res.status(502).json({ error: "Could not parse quiz generation response." });
      }
      var jsonStr = raw.slice(start, end + 1);
      var result = JSON.parse(jsonStr);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || "Server error in quiz generation." });
    }
  }


  // ----------------------------------------------------
  // ACTION 3: Standard Claim/News Verification
  // ----------------------------------------------------
  if (!content || content.trim().length < 5) {
    return res.status(400).json({ error: "No content provided." });
  }

  // Step 1: Live web search
  let searchContext = "";
  let searchSources = [];
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

      searchSources = results.map(function(r) {
        let domain = "";
        try {
          const u = new URL(r.link);
          domain = u.hostname.replace("www.", "");
        } catch (err) {
          domain = r.link || "";
        }
        return {
          title: r.title || "",
          link: r.link || "",
          snippet: r.snippet || "",
          date: r.date || "",
          domain: domain
        };
      });
    } catch (e) {
      searchContext = "";
      searchSources = [];
    }
  }

  const prompt = [
    'You are an expert fact-checker. Analyze this claim carefully.',
    'You MUST translate and write the values of all textual JSON fields (title, subtitle, summary, findings, supporting, contradicting, and indicators label) in the following language: ' + language + '.',
    '',
    'CLAIM: "' + content.slice(0, 2000) + '"',
    '',
    searchContext ? ('WEB SEARCH RESULTS:\n' + searchContext + '\n\nUse these as your PRIMARY source of truth.') : 'Use your training knowledge to analyze this claim carefully.',
    '',
    'You MUST respond with ONLY a single raw JSON object. No markdown. No backticks. No explanation. No newlines inside string values. Just the JSON:',
    '',
    '{"verdict":"REAL","confidence":85,"consensus":90,"evidence":80,"bias":15,"title":"Short verdict here","subtitle":"One sentence explanation.","summary":"Two sentence summary of claim and findings.","findings":"Finding one. Finding two. Finding three.","supporting":["Supporting point one","Supporting point two"],"contradicting":["Contradicting point one"],"indicators":[{"label":"Sources verified","type":"positive"},{"label":"Consistent facts","type":"positive"},{"label":"Some uncertainty","type":"neutral"}],"mediaBias":{"left":20,"center":60,"right":20},"socialBuzz":{"velocity":40,"sentiment":"Mixed","platforms":["Twitter","Reddit"]}}',
    '',
    'STRICT RULES:',
    '- The JSON keys (verdict, confidence, consensus, evidence, bias, title, subtitle, summary, findings, supporting, contradicting, indicators, label, type, mediaBias, left, center, right, socialBuzz, velocity, sentiment, platforms) must remain in English as defined.',
    '- verdict must be exactly: REAL, FAKE, or UNCERTAIN',
    '- confidence, consensus, evidence, bias, left, center, right, and velocity must be integers 0-100',
    '- All string values must be on one line with no line breaks',
    '- No bullet points, no special characters, no Unicode symbols in strings',
    '- findings must be plain sentences separated by periods only',
    '- supporting must be a JSON array of 1-3 short plain text statements supporting the verdict',
    '- contradicting must be a JSON array of 1-3 short plain text statements contradicting/debunking the claim'
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
            content: "You are a fact-checker AI. You ONLY output raw JSON. Never use markdown, backticks, bullet symbols, or newlines inside JSON string values. Plain UTF-8 text only inside strings. IMPORTANT: You must write all textual content in the JSON fields in the requested language: " + language + "."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 800
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

    // Clean control characters safely
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

    var consensus = parseInt(result.consensus, 10);
    if (isNaN(consensus) || consensus < 0) consensus = 50;
    if (consensus > 100) consensus = 100;

    var evidence = parseInt(result.evidence, 10);
    if (isNaN(evidence) || evidence < 0) evidence = 50;
    if (evidence > 100) evidence = 100;

    var bias = parseInt(result.bias, 10);
    if (isNaN(bias) || bias < 0) bias = 0;
    if (bias > 100) bias = 100;

    // Format findings with bullet prefix for display
    var findings = String(result.findings || "");
    var sentences = findings.split(". ");
    var bulletFindings = sentences
      .filter(function(s) { return s.trim().length > 2; })
      .map(function(s) { return "\u2022 " + s.trim().replace(/\.$/, ""); })
      .join("\n");

    var supporting = Array.isArray(result.supporting) ? result.supporting.slice(0, 3).map(String).map(s => s.trim()) : [];
    var contradicting = Array.isArray(result.contradicting) ? result.contradicting.slice(0, 3).map(String).map(s => s.trim()) : [];

    var clean = {
      verdict: verdict,
      confidence: confidence,
      consensus: consensus,
      evidence: evidence,
      bias: bias,
      title: String(result.title || verdict).slice(0, 80),
      subtitle: String(result.subtitle || "").slice(0, 200),
      summary: String(result.summary || "").slice(0, 500),
      findings: bulletFindings || findings,
      supporting: supporting,
      contradicting: contradicting,
      indicators: Array.isArray(result.indicators) ? result.indicators.slice(0, 5) : [],
      searchSources: searchSources,
      mediaBias: {
        left: result.mediaBias && typeof result.mediaBias.left === 'number' ? result.mediaBias.left : 33,
        center: result.mediaBias && typeof result.mediaBias.center === 'number' ? result.mediaBias.center : 34,
        right: result.mediaBias && typeof result.mediaBias.right === 'number' ? result.mediaBias.right : 33
      },
      socialBuzz: {
        velocity: result.socialBuzz && typeof result.socialBuzz.velocity === 'number' ? result.socialBuzz.velocity : 50,
        sentiment: result.socialBuzz && result.socialBuzz.sentiment ? String(result.socialBuzz.sentiment) : "Neutral",
        platforms: result.socialBuzz && Array.isArray(result.socialBuzz.platforms) ? result.socialBuzz.platforms : ["Web"]
      }
    };

    return res.status(200).json(clean);

  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error. Please try again." });
  }
};
