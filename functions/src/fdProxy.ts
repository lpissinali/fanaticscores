import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const fdApiKey = defineSecret('FD_API_KEY');
const FD_BASE = 'https://api.football-data.org/v4';

export const fdProxy = onRequest(
  { secrets: [fdApiKey], cors: true },
  async (req, res) => {
    const path = req.path.replace(/^\/api\/fd/, '') || '/';
    const params = new URLSearchParams(req.query as Record<string, string>);
    const qs = params.toString() ? `?${params}` : '';
    const upstream = await fetch(`${FD_BASE}${path}${qs}`, {
      headers: { 'X-Auth-Token': fdApiKey.value() },
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  }
);
