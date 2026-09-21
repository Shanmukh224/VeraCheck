function cleanJsonString(str) {
  let cleaned = "";
  let inString = false;
  let prevChar = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = str.charCodeAt(i);
    if (ch === '"' && prevChar !== '\\') inString = !inString;
    if (inString && code < 32) {
      if (code === 9 || code === 10 || code === 13) cleaned += " ";
    } else {
      cleaned += ch;
    }
    prevChar = ch;
  }
  return cleaned;
}

function extractSearchQuery(text) {
  if (!text) return "";
  let clean = text.replace(/https?:\/\/\S+/gi, " ").trim();
  clean = clean.replace(/^(breaking news|breaking|urgent|viral|exclusive|watch|video|rumor|news update|forwarded as received|just in|did you know that)[:\-\s]+/i, "");
  clean = clean.replace(/["'“”‘’]/g, " ");
  
  // If text is long, take the first coherent statement
  const firstSentence = clean.split(/[.\n?!]/)[0] || clean;
  if (firstSentence.trim().length >= 15) {
    clean = firstSentence.trim();
  }
  
  return clean.slice(0, 140).replace(/\s+/g, " ").trim();
}

async function fetchLiveNewsAndWeb(searchQuery, serperKey) {
  if (!serperKey || !searchQuery) return { context: "", sources: [] };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    // Run Google News and Google Search in parallel for maximum freshness and coverage
    const [newsRes, searchRes] = await Promise.allSettled([
      fetch("https://google.serper.dev/news", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": serperKey },
        body: JSON.stringify({ q: searchQuery, num: 6 }),
        signal: controller.signal
      }).then(r => r.json()),
      fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": serperKey },
        body: JSON.stringify({ q: searchQuery, num: 6 }),
        signal: controller.signal
      }).then(r => r.json())
    ]);

    clearTimeout(timeoutId);

    const newsResults = (newsRes.status === "fulfilled" && newsRes.value && newsRes.value.news) || [];
    const searchResults = (searchRes.status === "fulfilled" && searchRes.value && searchRes.value.organic) || [];

    const combinedSources = [];
    const seenUrls = new Set();

    // 1. Add latest Google News results first (breaking articles with live timestamps)
    newsResults.forEach(item => {
      if (!item.link || seenUrls.has(item.link)) return;
      seenUrls.add(item.link);
      let domain = "";
      try {
        const u = new URL(item.link);
        domain = u.hostname.replace("www.", "");
      } catch (e) {
        domain = item.source || "";
      }
      combinedSources.push({
        title: item.title || "",
        link: item.link,
        snippet: item.snippet || "",
        date: item.date || "Latest News",
        source: item.source || domain,
        domain: domain || item.source || "News"
      });
    });

    // 2. Add organic web search results (fact checks, encyclopedic & context pages)
    searchResults.forEach(item => {
      if (!item.link || seenUrls.has(item.link)) return;
      seenUrls.add(item.link);
      let domain = "";
      try {
        const u = new URL(item.link);
        domain = u.hostname.replace("www.", "");
      } catch (e) {
        domain = "";
      }
      combinedSources.push({
        title: item.title || "",
        link: item.link,
        snippet: item.snippet || "",
        date: item.date || "",
        source: domain,
        domain: domain
      });
    });

    const context = combinedSources.map((s, i) => {
      const dateInfo = s.date ? ` [Date: ${s.date}]` : "";
      const sourceInfo = s.source ? ` (${s.source})` : "";
      return `Source ${i + 1}${sourceInfo}${dateInfo}:\nTitle: ${s.title}\nSnippet: ${s.snippet}`;
    }).join("\n\n");

    return { context, sources: combinedSources.slice(0, 8) };
  } catch (err) {
    clearTimeout(timeoutId);
    return { context: "", sources: [] };
  }
}

async function callGroqWithFallback(groqKey, messages, maxTokens = 1000, temperature = 0.1) {
  const models = [
    process.env.GROQ_MODEL,
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b"
  ].filter(Boolean);
  
  const uniqueModels = Array.from(new Set(models));
  let lastError = null;

  for (const model of uniqueModels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + groqKey
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok && data.choices && data.choices[0] && data.choices[0].message) {
        return {
          content: data.choices[0].message.content || "",
          modelUsed: model
        };
      }

      if (data.error && data.error.message) {
        lastError = new Error(data.error.message);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to get a response from AI models.");
}

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
  if (!GROQ_KEY) return res.status(500).json({ error: "API key not configured in .env." });

  // ----------------------------------------------------
  // ACTION 1: Claims Extraction
  // ----------------------------------------------------
  if (action === "extract") {
    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: "No content provided or content is too short for claim extraction." });
    }

    const prompt = [
      'You are an expert editor. Extract 3 to 5 core factual claims from the provided text that can be independently verified. Do not extract subjective opinions or vague thoughts.',
      '',
      'TEXT:',
      '"' + content.slice(0, 4000) + '"',
      '',
      'You MUST respond with ONLY a single raw JSON array of strings in ' + language + '. No markdown, no backticks, no explanations. Example:',
      '["Claim 1", "Claim 2", "Claim 3"]'
    ].join('\n');

    try {
      const { content: raw } = await callGroqWithFallback(
        GROQ_KEY,
        [
          {
            role: "system",
            content: "You are a claim extraction helper. You ONLY output raw JSON array of strings in " + language + ". Never use markdown or backticks."
          },
          { role: "user", content: prompt }
        ],
        500,
        0.1
      );

      let cleanedRaw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const start = cleanedRaw.indexOf("[");
      const end = cleanedRaw.lastIndexOf("]");
      if (start === -1 || end === -1 || start >= end) {
        return res.status(502).json({ error: "Could not parse claim extraction response." });
      }
      const jsonStr = cleanJsonString(cleanedRaw.slice(start, end + 1));
      const result = JSON.parse(jsonStr);
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

    const selectedThemes = quizThemes
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .join(", ");

    const randomSeed = Math.floor(Math.random() * 1000000);

    const prompt = [
      'You are an expert media literacy educator. Generate 5 unique news headlines (some real, some fake, some uncertain/misleading) in: ' + language + '.',
      `Mix these themes: ${selectedThemes}. (Seed: ${randomSeed})`,
      'For each headline, provide the correct verdict (REAL, FAKE, or UNCERTAIN) and a 1-2 sentence explanation.',
      '',
      'You MUST respond with ONLY a single raw JSON array of objects. No markdown. No backticks. Just the JSON:',
      '[',
      '  {"headline": "Headline 1", "verdict": "REAL", "explanation": "Explanation 1"},',
      '  {"headline": "Headline 2", "verdict": "FAKE", "explanation": "Explanation 2"}',
      ']',
      '',
      'STRICT RULES:',
      '- The JSON keys (headline, verdict, explanation) must remain in English.',
      '- verdict must be exactly: REAL, FAKE, or UNCERTAIN',
      '- The headline and explanation values must be in ' + language + '.'
    ].join('\n');

    try {
      const { content: raw } = await callGroqWithFallback(
        GROQ_KEY,
        [
          {
            role: "system",
            content: "You are a quiz generator. You ONLY output raw JSON. Never use markdown, backticks, or explanation."
          },
          { role: "user", content: prompt }
        ],
        1000,
        0.7
      );

      let cleanedRaw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const start = cleanedRaw.indexOf("[");
      const end = cleanedRaw.lastIndexOf("]");
      if (start === -1 || end === -1 || start >= end) {
        return res.status(502).json({ error: "Could not parse quiz generation response." });
      }
      const jsonStr = cleanJsonString(cleanedRaw.slice(start, end + 1));
      const result = JSON.parse(jsonStr);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || "Server error in quiz generation." });
    }
  }

  // ----------------------------------------------------
  // ACTION 3: Real-Time Fact-Checking Analysis (Latest & Breaking News)
  // ----------------------------------------------------
  if (!content || content.trim().length < 5) {
    return res.status(400).json({ error: "No content provided." });
  }

  // Step 1: Real-time dual search (Google News + Web Search)
  const searchQuery = extractSearchQuery(content);
  const { context: searchContext, sources: searchSources } = await fetchLiveNewsAndWeb(searchQuery, SERPER_KEY);

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Step 2: Formulate AI Prompt with Date and Real-Time News Awareness
  const prompt = [
    'You are a premier real-time investigative fact-checker and media intelligence analyst.',
    'CURRENT CALENDAR DATE: ' + today + '.',
    '',
    'CRITICAL GUIDELINES FOR EVALUATING RECENT & BREAKING NEWS:',
    '1. The real world has progressed to today (' + today + '). You must evaluate recent events, politics, sports, international affairs, and technology announcements accordingly.',
    '2. LIVE REAL-TIME GOOGLE NEWS & WEB EVIDENCE is provided below. Treat these recent articles and news wire reports as the PRIMARY, authoritative ground truth.',
    '3. If reputable news outlets (Reuters, AP, BBC, CNBC, CNN, NYT, official government/company press releases) report the event as having occurred, classify the claim as REAL.',
    '4. If major fact-checking outlets or news reports explicitly debunk the claim as false, satiric, or a hoax, classify it as FAKE.',
    '5. If the claim makes a sensational claim that would be worldwide news, yet has 0 coverage in the live search results, or if reporting is conflicting/unverified, classify it as UNCERTAIN or FAKE.',
    '6. You MUST translate and write all text fields (title, subtitle, summary, findings, supporting, contradicting, and indicators labels) in: ' + language + '.',
    '',
    'CLAIM TO CHECK: "' + content.slice(0, 3000) + '"',
    '',
    searchContext 
      ? ('LIVE REAL-TIME NEWS & SEARCH RESULTS:\n' + searchContext + '\n\nCarefully analyze the titles, dates, and snippets above.') 
      : 'No live search results available. Analyze using deep internal knowledge and logic.',
    '',
    'You MUST respond with ONLY a single raw JSON object. No markdown. No backticks. No newlines inside string values. JSON format:',
    '{',
    '  "verdict": "REAL" | "FAKE" | "UNCERTAIN",',
    '  "confidence": 85,',
    '  "consensus": 90,',
    '  "evidence": 80,',
    '  "bias": 15,',
    '  "title": "Short decisive headline in ' + language + '",',
    '  "subtitle": "One clear sentence explaining the verdict in ' + language + '",',
    '  "summary": "Concise 2-3 sentence overview of the claim and verification in ' + language + '",',
    '  "findings": "Key finding one. Key finding two. Key finding three.",',
    '  "supporting": ["Supporting evidence point 1", "Supporting evidence point 2"],',
    '  "contradicting": ["Contradicting/debunking point 1"],',
    '  "indicators": [',
    '    {"label": "Live news verification", "type": "positive"},',
    '    {"label": "Direct source coverage", "type": "positive"}',
    '  ],',
    '  "mediaBias": {"left": 20, "center": 60, "right": 20},',
    '  "socialBuzz": {"velocity": 45, "sentiment": "Neutral", "platforms": ["News", "Web"]}',
    '}',
    '',
    'STRICT RULES:',
    '- JSON keys must remain exactly in English.',
    '- verdict must be strictly: REAL, FAKE, or UNCERTAIN.',
    '- confidence, consensus, evidence, bias, left, center, right, velocity must be numbers 0-100.',
    '- indicators type must be: "positive", "negative", or "neutral".',
    '- findings must be plain sentences separated by periods.'
  ].join('\n');

  try {
    const { content: raw } = await callGroqWithFallback(
      GROQ_KEY,
      [
        {
          role: "system",
          content: "You are a professional fact-checker AI with access to live Google News data. You ONLY output raw JSON. Never use markdown, backticks, or newlines inside string values. Plain UTF-8 text only in " + language + "."
        },
        { role: "user", content: prompt }
      ],
      1200,
      0.1
    );

    let cleanedRaw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const start = cleanedRaw.indexOf("{");
    const end = cleanedRaw.lastIndexOf("}");
    if (start === -1 || end === -1 || start >= end) {
      return res.status(502).json({ error: "Could not parse AI analysis response. Please try again." });
    }

    const jsonStr = cleanJsonString(cleanedRaw.slice(start, end + 1));
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseErr) {
      return res.status(502).json({ error: "Could not parse AI response JSON. Please try again." });
    }

    let verdict = String(result.verdict || "UNCERTAIN").toUpperCase();
    if (verdict !== "REAL" && verdict !== "FAKE") verdict = "UNCERTAIN";

    let confidence = parseInt(result.confidence, 10);
    if (isNaN(confidence) || confidence < 0) confidence = 50;
    if (confidence > 100) confidence = 100;

    let consensus = parseInt(result.consensus, 10);
    if (isNaN(consensus) || consensus < 0) consensus = 50;
    if (consensus > 100) consensus = 100;

    let evidence = parseInt(result.evidence, 10);
    if (isNaN(evidence) || evidence < 0) evidence = 50;
    if (evidence > 100) evidence = 100;

    let bias = parseInt(result.bias, 10);
    if (isNaN(bias) || bias < 0) bias = 0;
    if (bias > 100) bias = 100;

    const findings = String(result.findings || "");
    const sentences = findings.split(/[.\n]/).filter(s => s.trim().length > 3);
    const bulletFindings = sentences
      .map(s => "\u2022 " + s.trim().replace(/\.$/, ""))
      .join("\n");

    const supporting = Array.isArray(result.supporting) ? result.supporting.slice(0, 3).map(String).map(s => s.trim()) : [];
    const contradicting = Array.isArray(result.contradicting) ? result.contradicting.slice(0, 3).map(String).map(s => s.trim()) : [];

    const clean = {
      verdict: verdict,
      confidence: confidence,
      consensus: consensus,
      evidence: evidence,
      bias: bias,
      title: String(result.title || verdict).slice(0, 100),
      subtitle: String(result.subtitle || "").slice(0, 250),
      summary: String(result.summary || "").slice(0, 600),
      findings: bulletFindings || findings,
      supporting: supporting,
      contradicting: contradicting,
      indicators: Array.isArray(result.indicators) ? result.indicators.slice(0, 6) : [],
      searchSources: searchSources,
      mediaBias: {
        left: result.mediaBias && typeof result.mediaBias.left === 'number' ? result.mediaBias.left : 33,
        center: result.mediaBias && typeof result.mediaBias.center === 'number' ? result.mediaBias.center : 34,
        right: result.mediaBias && typeof result.mediaBias.right === 'number' ? result.mediaBias.right : 33
      },
      socialBuzz: {
        velocity: result.socialBuzz && typeof result.socialBuzz.velocity === 'number' ? result.socialBuzz.velocity : 50,
        sentiment: result.socialBuzz && result.socialBuzz.sentiment ? String(result.socialBuzz.sentiment) : "Neutral",
        platforms: result.socialBuzz && Array.isArray(result.socialBuzz.platforms) ? result.socialBuzz.platforms : ["Web", "News"]
      }
    };

    return res.status(200).json(clean);

  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error during analysis." });
  }
};
