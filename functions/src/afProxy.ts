import { onRequest } from 'firebase-functions/v2/https';
import { afApiKey }  from './apiFootballFetch';

const AF_BASE = 'https://v3.football.api-sports.io';

export const afProxy = onRequest(
  { secrets: [afApiKey], cors: true },
  async (req, res) => {
    const path   = req.path.replace(/^\/api\/af/, '') || '/';
    const params = new URLSearchParams(req.query as Record<string, string>);
    const qs     = params.toString() ? `?${params}` : '';

    try {
      const upstream = await fetch(`${AF_BASE}${path}${qs}`, {
        headers: { 'x-apisports-key': afApiKey.value() },
      });
      const data = await upstream.json();
      res.status(upstream.status).json(data);
    } catch (err) {
      console.error('[afProxy] error', err);
      res.status(502).json({ error: 'upstream error' });
    }
  }
);
