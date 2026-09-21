// VeraCheck — News Article URL Scraper & Content Extractor

function extractMetaTag(html, property) {
  const match = html.match(new RegExp(`<meta\\s+[^>]*?(?:property|name)=["'](?:og:)?${property}["'][^>]*?content=["']([^"']*)["']`, 'i')) ||
                html.match(new RegExp(`<meta\\s+[^>]*?content=["']([^"']*)["'][^>]*?(?:property|name)=["'](?:og:)?${property}["']`, 'i'));
  return match && match[1] ? match[1].trim() : '';
}

function cleanHtmlText(html) {
  if (!html) return '';
  
  // Strip head, scripts, styles, navigations, footers, headers, asides, iframes
  let text = html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Prioritize <article> if present
  const articleMatch = text.match(/<article[\s\S]*?<\/article>/i);
  if (articleMatch) {
    text = articleMatch[0];
  }

  // Extract all paragraph texts
  const paragraphs = [];
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(text)) !== null) {
    const rawP = pMatch[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (rawP.length > 25) {
      paragraphs.push(rawP);
    }
  }

  if (paragraphs.length > 0) {
    return paragraphs.join('\n\n');
  }

  // Fallback: strip all tags from remaining text
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Valid article URL is required.' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url.trim());
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'URL must begin with http:// or https://' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format.' });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(parsedUrl.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (VeraCheck FactBot; +https://veracheck.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(502).json({ error: `Target website returned status ${response.status} (${response.statusText}).` });
    }

    const html = await response.text();

    // Extract title from <title> or og:title
    let title = extractMetaTag(html, 'title');
    if (!title) {
      const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
      title = titleTag && titleTag[1] ? titleTag[1].replace(/<[^>]+>/g, '').trim() : '';
    }

    const description = extractMetaTag(html, 'description');
    const cleanContent = cleanHtmlText(html);

    if (!cleanContent || cleanContent.length < 50) {
      return res.status(422).json({
        error: 'Unable to extract sufficient article text from this page. The site may be behind a paywall or JavaScript barrier. Please copy and paste the text manually.'
      });
    }

    // Limit extracted body text to top 3500 chars
    const trimmedBody = cleanContent.slice(0, 3500);
    const wordCount = trimmedBody.split(/\s+/).filter(Boolean).length;

    return res.status(200).json({
      success: true,
      url: parsedUrl.href,
      domain: parsedUrl.hostname.replace(/^www\./i, ''),
      title: title || 'Extracted Article',
      description: description || '',
      content: trimmedBody,
      wordCount: wordCount
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Article fetch timed out after 8 seconds. Please try again or paste text manually.' });
    }
    return res.status(500).json({ error: err.message || 'Failed to fetch article from the provided URL.' });
  }
};
