"use strict";
/**
 * AI Brief generator — calls Claude Haiku with today's match context.
 *
 * Cost optimisations vs. the original:
 *  - TTL raised to 20 min (live) / 2 h (quiet) → ~4× fewer API calls
 *  - Upcoming matches excluded from context (they don't make interesting copy)
 *  - Context capped at 12 most-significant matches, with competition tier
 *  - Hash-based short-circuit: skips the API call if live/FT state is unchanged
 *  - max_tokens 320 + trim-to-last-sentence so the brief never ends mid-clause
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
    ACL: 'AFC Champions League', ACL2: 'AFC Champions League Two', CAFCL: 'CAF Champions League',
    CCL: 'CONCACAF Champions League', GOLD: 'Gold Cup', ASIAN: 'Asian Cup',
    CNL: 'CONCACAF Nations League', USC: 'UEFA Super Cup', CDB: 'Copa do Brasil',
};
// ── Build a compact, editorially-weighted context string ──────────────────────
function buildContext(competitions) {
    var _a, _b, _c, _d, _e;
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
            else if (m.status === 'FT' || m.status === 'AET' || m.status === 'PEN') {
                // Only include finished matches that actually have a score worth
                // mentioning. Spell out the stage + how a tie was decided so the model
                // never mistakes a knockout shootout for a group-stage draw.
                if (hs !== null && as_ !== null) {
                    const stageLabel = comp.stage ? ` · ${comp.stage}` : '';
                    const winnerName = m.winner === 'home' ? h : m.winner === 'away' ? a : null;
                    const loserName = m.winner === 'home' ? a : m.winner === 'away' ? h : null;
                    let line = `[${tier}${stageLabel}] ${h} ${score} ${a}`;
                    if (m.status === 'PEN' && winnerName) {
                        // Present the shootout score winner-first so it reads correctly
                        // regardless of which side (home/away) won.
                        const pHome = (_c = (_b = m.penalty) === null || _b === void 0 ? void 0 : _b.home) !== null && _c !== void 0 ? _c : 0;
                        const pAway = (_e = (_d = m.penalty) === null || _d === void 0 ? void 0 : _d.away) !== null && _e !== void 0 ? _e : 0;
                        const pens = m.penalty ? ` ${m.winner === 'home' ? `${pHome}–${pAway}` : `${pAway}–${pHome}`}` : '';
                        line += ` — level after extra time; ${winnerName} won${pens} on penalties and advance, ${loserName} eliminated`;
                    }
                    else if (m.status === 'PEN') {
                        line += ` — decided on penalties`;
                    }
                    else if (m.status === 'AET' && winnerName) {
                        line += ` — ${winnerName} won after extra time and advance, ${loserName} eliminated`;
                    }
                    else if (m.status === 'AET') {
                        line += ` — after extra time`;
                    }
                    finished.push(line);
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
            if (m.status === 'LIVE' || m.status === 'HT' || m.status === 'FT' || m.status === 'AET' || m.status === 'PEN') {
                parts.push(`${m.id}:${m.status}:${m.home.score}:${m.away.score}:${(_a = m.minute) !== null && _a !== void 0 ? _a : ''}`);
            }
        }
    }
    // Simple hash — good enough to detect score changes
    return parts.sort().join('|');
}
// ── Sentence-boundary guard ───────────────────────────────────────────────────
// Defends against a brief that ends mid-sentence (e.g. the model hit max_tokens
// partway through a clause — "...It's the kind of performance that"). If the
// text doesn't already end on terminal punctuation, trim back to the last
// complete sentence so the card never shows a dangling fragment. With the
// higher max_tokens this is usually a no-op; it's the belt-and-suspenders.
function trimToLastSentence(text) {
    const t = text.trim();
    if (!t)
        return t;
    if (/[.!?]["'”’)]?$/.test(t))
        return t; // already ends cleanly
    const lastEnd = Math.max(t.lastIndexOf('.'), t.lastIndexOf('!'), t.lastIndexOf('?'));
    if (lastEnd <= 0)
        return t; // no sentence boundary found — leave as-is
    return t.slice(0, lastEnd + 1).trim();
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
        // Reuse only when BOTH hold: a recent brief AND no change in match state.
        // (Previously `||`, which reused a still-fresh brief even after the score/
        // status changed — so a corrected brief could lag up to a full TTL.)
        if (fresh && unchanged) {
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
    const prompt = `You are a sharp football writer for a live scores app. Write a brief, opinionated read on today's action — not a list or a dry summary, but an actual take with voice.

Reply as one or two labelled sections, using ONLY the sections that have matches in the data below:
**LIVE:** two sentences on the most compelling in-progress match (treat half-time games as live) — the tension, the goals, the drama. Present tense.
**FINISHED:** two sentences leading with the most surprising or significant result. Past tense.

Editorial rules:
- Begin each section with its label inline exactly as written (e.g. "**LIVE:** Austria are…"), and separate the two sections with a blank line.
- Include a section ONLY if the data has matches in that state: only finished matches → write just FINISHED; only live → just LIVE.
- Prioritise higher-tier competitions (Champions League > MLS, etc.).
- A comeback, an upset, or a high-scoring game beats a routine win.
- For knockout ties (Round of 32/16, quarter-final, etc.), frame the result as who advanced and who was eliminated — never as "a point", "a draw", or league/group standing. A penalty-shootout result means the winner went through and the loser is OUT; the level 90/120-minute score is not a draw in the table sense.
- Be specific — teams, scores, minute — and always finish your sentences.
- Never write "Here is…" or "In today's…" — start straight with the story.

Match data:
${context}`;
    try {
        const client = new sdk_1.default({ apiKey: anthropicKey });
        const msg = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 320,
            messages: [{ role: 'user', content: prompt }],
        });
        const text = msg.content.find(b => b.type === 'text');
        const brief = trimToLastSentence((text === null || text === void 0 ? void 0 : text.type) === 'text' ? text.text : '');
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