/**
 * AI Brief generator — calls Claude Haiku with today's match context
 * and returns a 2-3 sentence football brief.
 *
 * Rate-limited: regenerates at most every 5 minutes for live days,
 * every 15 minutes otherwise, to keep API costs low.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { CompetitionData } from './apiFootballFetch';

const BRIEF_TTL_LIVE    =  5 * 60 * 1000;  // 5 min  (live match days)
const BRIEF_TTL_NO_LIVE = 15 * 60 * 1000;  // 15 min (quiet days)

// ── Build a compact context string for the prompt ─────────────────────────────

function buildContext(competitions: CompetitionData[], hasLive: boolean): string {
  const lines: string[] = [];

  const live:      string[] = [];
  const ht:        string[] = [];
  const finished:  string[] = [];
  const upcoming:  string[] = [];

  for (const comp of competitions) {
    for (const m of comp.matches) {
      const h = m.home.name;
      const a = m.away.name;
      const hs = m.home.score;
      const as_ = m.away.score;
      const score = hs !== null && as_ !== null ? `${hs}–${as_}` : 'vs';
      const label = `${comp.country} ${comp.name}`;

      if (m.status === 'LIVE') {
        const min = m.minute ? ` ${m.minute}'` : '';
        live.push(`${h} ${score} ${a} (${label}${min})`);
      } else if (m.status === 'HT') {
        ht.push(`${h} ${score} ${a} — Half Time (${label})`);
      } else if (m.status === 'FT') {
        finished.push(`${h} ${score} ${a} — FT (${label})`);
      } else if (m.status === 'SCHEDULED' && m.kickoff) {
        upcoming.push(`${h} vs ${a} at ${m.kickoff} (${label})`);
      }
    }
  }

  if (live.length)     lines.push('LIVE:\n' + live.join('\n'));
  if (ht.length)       lines.push('HALF TIME:\n' + ht.join('\n'));
  if (finished.length) lines.push('FINISHED:\n' + finished.join('\n'));
  if (upcoming.length) lines.push('UPCOMING:\n' + upcoming.join('\n'));

  return lines.join('\n\n') || 'No matches today.';
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface BriefResult {
  brief: string;
  generatedAt: number;
}

export async function generateAiBrief(
  competitions: CompetitionData[],
  hasLive: boolean,
  existingBrief: string | null,
  existingBriefAt: number,
  anthropicKey: string,
): Promise<BriefResult> {
  const now = Date.now();
  const ttl = hasLive ? BRIEF_TTL_LIVE : BRIEF_TTL_NO_LIVE;

  // Return existing brief if still fresh
  if (existingBrief && existingBriefAt && (now - existingBriefAt) < ttl) {
    console.log(`[aiBrief] using existing brief (${Math.round((now - existingBriefAt) / 1000)}s old)`);
    return { brief: existingBrief, generatedAt: existingBriefAt };
  }

  const context = buildContext(competitions, hasLive);

  // If there's nothing to say, skip the API call
  if (competitions.length === 0) {
    return { brief: 'No matches scheduled today.', generatedAt: now };
  }

  const prompt = `You are a football journalist writing a punchy daily brief for fans checking scores.

Here is today's match data:

${context}

Write exactly 2-3 sentences covering the most interesting storylines — goals, surprises, tight games, or key upcoming matches. Be specific: mention team names and scores. Use present tense for live matches, past tense for finished ones. No bullet points, no headers — just flowing sentences a fan would enjoy reading.`;

  try {
    const client = new Anthropic({ apiKey: anthropicKey });
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 180,
      messages:   [{ role: 'user', content: prompt }],
    });

    const text = msg.content.find(b => b.type === 'text');
    const brief = text?.type === 'text' ? text.text.trim() : '';
    console.log(`[aiBrief] generated: "${brief.slice(0, 80)}…"`);
    return { brief, generatedAt: now };
  } catch (err) {
    console.error('[aiBrief] Claude API error:', err);
    // On error keep the existing brief rather than clearing it
    return {
      brief:       existingBrief ?? 'Unable to generate brief right now.',
      generatedAt: existingBriefAt,
    };
  }
}
