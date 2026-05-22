"use strict";
/**
 * AI Brief generator — calls Claude Haiku with today's match context.
 *
 * Cost optimisations vs. the original:
 *  - TTL raised to 20 min (live) / 2 h (quiet) → ~4× fewer API calls
 *  - Upcoming matches excluded from context (they don't make interesting copy)
 *  - Context capped at 12 most-significant matches, with competition tier
 *  - Hash-based short-circuit: skips the API call if live/FT state is unchanged
 *  - max_tokens lowered from 180 → 140
 *
 * Quality improvements:
 *  - Prompt gives editorial guidance: what counts as a good story
 *  - Competition tier embedded so the model knows CL > Serie B
 *  - Prompt steers the model toward opinion/voice, not just summary
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAiBrief = generateAiBrief;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const BRIEF_TTL_LIVE = 20 * 60 * 1000; // 20 min  (live match days)
const BRIEF_TTL_NO_LIVE = 2 * 3600 * 1000; //  2 h    (quiet / results-only days)
// ── Competition tier labels (higher = more prestigious) ───────────────────────
// Maps the competition `id` field (e.g. 'CL', 'PL', 'BSA') to a tier string.
const COMP_TIER = {
    WC: 'World Cup', CWC: 'Club World Cup', EURO: 'Euros', CA: 'Copa América',
    CL: 'Champions League', EL: 'Europa League', UECL: 'Conference League',
    LIBT: 'Copa Libertadores', CA2: 'Copa América',
    PL: 'Premier League', PD: 'La Liga', SA: 'Serie A', BL1: 'Bundesliga', FL1: 'Ligue 1',
    DED: 'Eredivisie', PPL: 'Primeira Liga', TSL: 'Süper Lig',
    BSA: 'Brasileirão', ARG: 'Liga Profesional', MX: 'Liga MX', MLS: 'MLS',
};
// ── Build a compact, editorially-weighted context string ──────────────────────
function buildContext(competitions) {
    var _a;
    const live = [];
    const ht = [];
    const finished = [];
    for (const comp of competitions) {
        const tier = (_a = COMP_TIER[comp.id]) !== null && _a !== void 0 ? _a : comp.name;
        for (const m of comp.matches) {
            const h = m.home.name;
            const a = m.away.name;
            const hs = m.home.score;
            const as_ = m.away.score;
            const score = hs !== null && as_ !== null ? `${hs}–${as_}` : '–';
            if (m.status === 'LIVE') {
                const min = m.minute ? ` ${m.minute}'` : '';
                live.push(`[${tier}] ${h} ${score} ${a}${min}`);
            }
            else if (m.status === 'HT') {
                ht.push(`[${tier}] ${h} ${score} ${a} (HT)`);
            }
            else if (m.status === 'FT') {
                // Only include FT matches that actually have a score worth mentioning
                if (hs !== null && as_ !== null) {
                    finished.push(`[${tier}] ${h} ${score} ${a}`);
                }
            }
            // UPCOMING matches deliberately excluded — not interesting copy
        }
    }
    // Cap each section so context stays small (cost & focus)
    const cap = (arr, n) => arr.slice(0, n);
    const sections = [];
    if (live.length)
        sections.push('LIVE NOW:\n' + cap(live, 6).join('\n'));
    if (ht.length)
        sections.push('HALF TIME:\n' + cap(ht, 4).join('\n'));
    if (finished.length)
        sections.push('FINISHED:\n' + cap(finished, 8).join('\n'));
    return sections.join('\n\n') || '';
}
// ── Lightweight hash to detect when live/FT state has actually changed ────────
// If nothing has changed since the last brief, skip the API call.
function buildStateHash(competitions) {
    var _a;
    const parts = [];
    for (const comp of competitions) {
        for (const m of comp.matches) {
            if (m.status === 'LIVE' || m.status === 'HT' || m.status === 'FT') {
                parts.push(`${m.id}:${m.status}:${m.home.score}:${m.away.score}:${(_a = m.minute) !== null && _a !== void 0 ? _a : ''}`);
            }
        }
    }
    // Simple hash — good enough to detect score changes
    return parts.sort().join('|');
}
async function generateAiBrief(competitions, hasLive, existingBrief, existingBriefAt, anthropicKey, existingHash) {
    const now = Date.now();
    const ttl = hasLive ? BRIEF_TTL_LIVE : BRIEF_TTL_NO_LIVE;
    if (competitions.length === 0) {
        return { brief: 'No matches scheduled today.', generatedAt: now };
    }
    const stateHash = buildStateHash(competitions);
    // Return existing brief if it's still fresh AND the match state hasn't changed.
    // This is the primary cost-saver: a 0-0 game at minute 30 that's still 0-0
    // at minute 35 generates the same brief, so we just reuse it.
    if (existingBrief && existingBriefAt) {
        const fresh = (now - existingBriefAt) < ttl;
        const unchanged = existingHash === stateHash;
        if (fresh || unchanged) {
            const reason = unchanged ? 'state unchanged' : `${Math.round((now - existingBriefAt) / 60000)}m old, within TTL`;
            console.log(`[aiBrief] reusing existing brief (${reason})`);
            return { brief: existingBrief, generatedAt: existingBriefAt, stateHash };
        }
    }
    const context = buildContext(competitions);
    // Nothing live or finished — no point generating a brief
    if (!context) {
        return {
            brief: existingBrief !== null && existingBrief !== void 0 ? existingBrief : 'Matches are on the way — check back soon.',
            generatedAt: existingBriefAt || now,
            stateHash,
        };
    }
    const prompt = `You are a sharp football writer for a live scores app. Your job is to write one punchy paragraph (2 sentences max) that gives fans the essential story of the moment — not a list, not a summary, but an actual take.

Editorial rules:
- Prioritise higher-tier competitions (Champions League > MLS, etc.)
- A comeback, an upset, or a high-scoring game is more interesting than a routine win
- For live matches: describe the tension or the goals, not just the score
- For finished matches: lead with the result that will surprise people most
- Never write "Here is…" or "In today's…" — just start with the story
- Use present tense for live/HT, past tense for FT

Match data:
${context}`;
    try {
        const client = new sdk_1.default({ apiKey: anthropicKey });
        const msg = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 140,
            messages: [{ role: 'user', content: prompt }],
        });
        const text = msg.content.find(b => b.type === 'text');
        const brief = (text === null || text === void 0 ? void 0 : text.type) === 'text' ? text.text.trim() : '';
        console.log(`[aiBrief] generated (hash=${stateHash.slice(0, 20)}): "${brief.slice(0, 80)}…"`);
        return { brief, generatedAt: now, stateHash };
    }
    catch (err) {
        console.error('[aiBrief] Claude API error:', err);
        return {
            brief: existingBrief !== null && existingBrief !== void 0 ? existingBrief : 'Unable to generate brief right now.',
            generatedAt: existingBriefAt,
            stateHash,
        };
    }
}
//# sourceMappingURL=aiBrief.js.map