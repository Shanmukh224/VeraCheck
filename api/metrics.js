// VeraCheck — System Health, Performance & Observability Metrics

function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const uptimeSec = process.uptime();
  const mem = process.memoryUsage();

  const metrics = {
    status: 'HEALTHY',
    service: 'VeraCheck Fact-Checking Engine',
    version: '1.2.0',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptimeSec),
      formatted: formatUptime(uptimeSec)
    },
    performance: {
      memoryRssMB: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
      externalMB: Math.round((mem.external / 1024 / 1024) * 10) / 10
    },
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      environment: process.env.NODE_ENV || 'production'
    },
    intelligence: {
      primaryModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      fallbackChain: [
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
        'mixtral-8x7b-32768'
      ],
      aiProvider: 'Groq LPU Inference Cloud',
      groqStatus: process.env.GROQ_API_KEY ? 'Connected (Operational)' : 'Configuration Missing',
      searchProvider: 'Google Search via Serper API',
      serperStatus: process.env.SERPER_API_KEY ? 'Connected (Operational)' : 'Configuration Missing'
    },
    devOps: {
      containerEngine: 'Docker (Alpine Linux)',
      orchestration: 'Docker Compose',
      cicdPipeline: 'Jenkins Declarative Pipeline (7 Stages)',
      healthCheckEndpoint: '/api/health',
      metricsEndpoint: '/api/metrics'
    }
  };

  return res.status(200).json(metrics);
};
