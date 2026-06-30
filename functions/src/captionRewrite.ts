/**
 * Caption Rewrite — generates an AI social caption for a Studio card.
 */

import { onRequest } from 'firebase-functions/v2/https';
import Anthropic from '@anthropic-ai/sdk';
import { anthropicApiKey } from './secrets';

export const captionRewrite = onRequest(
  { secrets: [anthropicApiKey], cors: true, timeoutSeconds: 30 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }

    const {
      home, away,
      homeScore, awayScore,
      competition, status, minute,
      template,
    } = req.body as {
      home: string; away: string;
      homeScore: number | null; awayScore: number | null;
      competition: string; status: string; minute?: string;
      template: string;
    };

    if (!home || !away) {
      res.status(400).json({ error: 'home and away required' });
      return;
    }

    const hasScore = homeScore !== null && awayScore !== null;
    const scoreStr = hasScore ? `${homeScore}-${awayScore}` : '';
    const statusStr = status === 'LIVE'
      ? `Live ${minute ?? '?'}'`
      : status === 'FT' ? 'Full Time'
      : status === 'AET' ? 'After Extra Time'
      : status === 'PEN' ? 'After Penalties'
      : status === 'HT' ? 'Half Time'
      : 'Upcoming';

    const matchLine = hasScore
      ? `${home} ${scoreStr} ${away} (${statusStr}, ${competition})`
      : `${home} vs ${away} (${statusStr}, ${competition})`;

    const templateGuidance = template === 'ticker'
      ? 'Write a punchy bold news-ticker headline in ALL CAPS, max 10 words.'
      : 'Write a short editorial headline, sentence-case, max 12 words.';

    const prompt = `You are a sharp football writer crafting social copy for a live scores card.\n\nMatch: ${matchLine}\n\n${templateGuidance}\nDo NOT include hashtags — reply with the headline text only, no explanation, no quotes.`;

    try {
      const client = new Anthropic({ apiKey: anthropicApiKey.value() });
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      });

      const block = msg.content.find(b => b.type === 'text');
      const caption = block?.type === 'text' ? block.text.trim() : '';
      res.json({ caption });
    } catch (err) {
      console.error('[captionRewrite] error', err);
      res.status(500).json({ error: 'AI generation failed' });
    }
  }
);
