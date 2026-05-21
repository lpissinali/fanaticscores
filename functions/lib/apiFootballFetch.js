"use strict";
/**
 * api-football.com v3 fetching logic shared by scheduled + on-demand functions.
 * Replaces footballDataFetch.ts — single /fixtures?date=DATE call (all leagues at once).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEAGUE_LIST = exports.afApiKey = void 0;
exports.calcNextFetch = calcNextFetch;
exports.fetchMatchday = fetchMatchday;
const params_1 = require("firebase-functions/params");
exports.afApiKey = (0, params_1.defineSecret)('AF_API_KEY');
const AF_BASE = 'https://v3.football.api-sports.io';
// League definitions ordered highest → lowest priority.
// id = api-football league ID, code = internal code kept for cache/UI consistency.
exports.LEAGUE_LIST = [
    // ── International tournaments ────────────────────────────────────────────────
    { id: 1, code: 'WC', name: 'FIFA World Cup', country: 'World', short: 'WC', flag: '#8b6914', type: 'CUP' },
    { id: 15, code: 'CWC', name: 'Club World Cup', country: 'World', short: 'CWC', flag: '#8b6914', type: 'CUP' },
    { id: 4, code: 'EURO', name: 'UEFA European Championship', country: 'Europe', short: 'EURO', flag: '#1a3a6b', type: 'CUP' },
    { id: 9, code: 'CA', name: 'Copa America', country: 'S. America', short: 'CA', flag: '#006400', type: 'CUP' },
    { id: 6, code: 'AFCN', name: 'Africa Cup of Nations', country: 'Africa', short: 'AFCN', flag: '#8b4513', type: 'CUP' },
    { id: 5, code: 'UNL', name: 'UEFA Nations League', country: 'Europe', short: 'UNL', flag: '#1a3a6b', type: 'CUP' },
    // ── UEFA club competitions ────────────────────────────────────────────────────
    { id: 2, code: 'CL', name: 'UEFA Champions League', country: 'Europe', short: 'UCL', flag: '#1a3a6b', type: 'CUP' },
    { id: 3, code: 'EL', name: 'UEFA Europa League', country: 'Europe', short: 'UEL', flag: '#e87800', type: 'CUP' },
    { id: 848, code: 'UECL', name: 'UEFA Conference League', country: 'Europe', short: 'UECL', flag: '#1a6b3a', type: 'CUP' },
    // ── South American club competitions ─────────────────────────────────────────
    { id: 13, code: 'LIBT', name: 'Copa Libertadores', country: 'S. America', short: 'LIBT', flag: '#006400', type: 'CUP' },
    { id: 11, code: 'CSUD', name: 'Copa Sudamericana', country: 'S. America', short: 'CSUD', flag: '#005500', type: 'CUP' },
    // ── Top 5 European leagues ────────────────────────────────────────────────────
    { id: 39, code: 'PL', name: 'Premier League', country: 'England', short: 'PL', flag: '#3d0d6b', type: 'LEAGUE' },
    { id: 140, code: 'PD', name: 'La Liga', country: 'Spain', short: 'LL', flag: '#8b0000', type: 'LEAGUE' },
    { id: 135, code: 'SA', name: 'Serie A', country: 'Italy', short: 'SA', flag: '#003580', type: 'LEAGUE' },
    { id: 78, code: 'BL1', name: 'Bundesliga', country: 'Germany', short: 'BL', flag: '#cc0000', type: 'LEAGUE' },
    { id: 61, code: 'FL1', name: 'Ligue 1', country: 'France', short: 'L1', flag: '#003189', type: 'LEAGUE' },
    // ── Other European leagues ────────────────────────────────────────────────────
    { id: 88, code: 'DED', name: 'Eredivisie', country: 'Netherlands', short: 'ERE', flag: '#ff6600', type: 'LEAGUE' },
    { id: 94, code: 'PPL', name: 'Primeira Liga', country: 'Portugal', short: 'PPL', flag: '#006600', type: 'LEAGUE' },
    { id: 179, code: 'SPL', name: 'Scottish Premiership', country: 'Scotland', short: 'SPL', flag: '#003399', type: 'LEAGUE' },
    { id: 144, code: 'JPL', name: 'Jupiler Pro League', country: 'Belgium', short: 'JPL', flag: '#fdda24', type: 'LEAGUE' },
    { id: 203, code: 'TSL', name: 'Super Lig', country: 'Turkey', short: 'TSL', flag: '#e30a17', type: 'LEAGUE' },
    { id: 307, code: 'SAPL', name: 'Saudi Pro League', country: 'Saudi Arabia', short: 'SAPL', flag: '#006400', type: 'LEAGUE' },
    // ── Second divisions ─────────────────────────────────────────────────────────
    { id: 40, code: 'ELC', name: 'Championship', country: 'England', short: 'CH', flag: '#2d0d5b', type: 'LEAGUE' },
    { id: 141, code: 'SD', name: 'La Liga 2', country: 'Spain', short: 'LL2', flag: '#8b0000', type: 'LEAGUE' },
    { id: 136, code: 'SB', name: 'Serie B', country: 'Italy', short: 'SB', flag: '#003580', type: 'LEAGUE' },
    { id: 79, code: 'BL2', name: '2. Bundesliga', country: 'Germany', short: 'BL2', flag: '#cc0000', type: 'LEAGUE' },
    { id: 62, code: 'FL2', name: 'Ligue 2', country: 'France', short: 'L2', flag: '#003189', type: 'LEAGUE' },
    // ── Americas ─────────────────────────────────────────────────────────────────
    { id: 71, code: 'BSA', name: 'Brasileirao', country: 'Brazil', short: 'BSA', flag: '#006400', type: 'LEAGUE' },
    { id: 128, code: 'ARG', name: 'Liga Profesional', country: 'Argentina', short: 'ARG', flag: '#75aadb', type: 'LEAGUE' },
    { id: 262, code: 'MX', name: 'Liga MX', country: 'Mexico', short: 'MX', flag: '#006847', type: 'LEAGUE' },
    { id: 253, code: 'MLS', name: 'MLS', country: 'USA', short: 'MLS', flag: '#002a5c', type: 'LEAGUE' },
    { id: 239, code: 'COL', name: 'Primera A', country: 'Colombia', short: 'COL', flag: '#fcd116', type: 'LEAGUE' },
    { id: 265, code: 'CHI', name: 'Primera Division', country: 'Chile', short: 'CHI', flag: '#d52b1e', type: 'LEAGUE' },
    // ── Asia ─────────────────────────────────────────────────────────────────────
    { id: 98, code: 'J1', name: 'J1 League', country: 'Japan', short: 'J1', flag: '#bc002d', type: 'LEAGUE' },
    { id: 169, code: 'CSL', name: 'Chinese Super League', country: 'China', short: 'CSL', flag: '#de2910', type: 'LEAGUE' },
    // ── Domestic cups ────────────────────────────────────────────────────────────
    { id: 45, code: 'FAC', name: 'FA Cup', country: 'England', short: 'FAC', flag: '#3d0d6b', type: 'CUP' },
    { id: 48, code: 'LCC', name: 'Carabao Cup', country: 'England', short: 'EFL', flag: '#3d0d6b', type: 'CUP' },
    { id: 143, code: 'CDR', name: 'Copa del Rey', country: 'Spain', short: 'CDR', flag: '#8b0000', type: 'CUP' },
    { id: 81, code: 'DFB', name: 'DFB-Pokal', country: 'Germany', short: 'DFB', flag: '#cc0000', type: 'CUP' },
    { id: 137, code: 'CI', name: 'Coppa Italia', country: 'Italy', short: 'CI', flag: '#003580', type: 'CUP' },
    { id: 66, code: 'CDF', name: 'Coupe de France', country: 'France', short: 'CDF', flag: '#003189', type: 'CUP' },
];
const ALLOWED_IDS = new Set(exports.LEAGUE_LIST.map(l => l.id));
const LEAGUE_BY_ID = new Map(exports.LEAGUE_LIST.map(l => [l.id, l]));
// Higher number = higher priority in featured-match selection.
const TIER = {
    // International
    1: 12, 4: 12, 9: 11, 6: 11, 15: 10,
    // UEFA club
    2: 10, 3: 9, 848: 7, 5: 7,
    // South American club
    13: 9, 11: 7,
    // Top 5 leagues
    39: 8, 140: 8, 135: 8, 78: 7, 61: 7,
    // Other European leagues
    88: 6, 94: 6, 179: 5, 144: 5, 203: 5, 307: 5,
    // 2nd divisions
    40: 4, 141: 4, 136: 4, 79: 4, 62: 4,
    // Americas
    71: 5, 128: 5, 262: 5, 253: 5, 239: 3, 265: 3,
    // Asia
    98: 4, 169: 3,
    // Domestic cups
    45: 6, 48: 4, 143: 6, 81: 6, 137: 6, 66: 6,
};
// ── Mapping helpers ──────────────────────────────────────────────────────────
function mapStatus(s) {
    switch (s) {
        case '1H':
        case '2H':
        case 'ET':
        case 'BT':
        case 'P': return 'LIVE';
        case 'HT': return 'HT';
        case 'FT':
        case 'AET':
        case 'PEN': return 'FT';
        case 'PST': return 'POSTPONED';
        case 'CANC':
        case 'ABD':
        case 'SUSP':
        case 'INT': return 'CANCELLED';
        default: return 'SCHEDULED';
    }
}
function formatKickoff(isoDate) {
    return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function mapTeam(af, score) {
    const words = af.name.split(/\s+/);
    const initial = words.length >= 2
        ? words.map(w => w[0]).join('').slice(0, 3).toUpperCase()
        : af.name.slice(0, 3).toUpperCase();
    return {
        id: String(af.id),
        name: af.name,
        short: words[0],
        initial,
        color: '#3a3a48',
        crest: af.logo || undefined,
        score,
    };
}
function parseRound(round) {
    if (!round)
        return undefined;
    // "Regular Season - 20" → "Matchday 20", "Group Stage - A" → "Group Stage A"
    const m = round.match(/^(.+?)\s*-\s*(.+)$/);
    if (!m)
        return round;
    const [, prefix, suffix] = m;
    if (/regular\s+season/i.test(prefix))
        return `Matchday ${suffix}`;
    return `${prefix} ${suffix}`;
}
// ── Next-fetch timing (unchanged from old implementation) ────────────────────
function calcNextFetch(date, hasLive, hadErrors, now) {
    const today = new Date().toISOString().slice(0, 10);
    if (date < today)
        return hadErrors ? now + 30 * 60000 : now + 24 * 3600000;
    if (date > today)
        return now + (hadErrors ? 30 * 60000 : 2 * 3600000);
    if (hasLive)
        return now + 5 * 60000; // live: every 5 min
    if (hadErrors)
        return now + 30 * 60000;
    return now + 30 * 60000; // no live: every 30 min
}
// ── Main fetch ───────────────────────────────────────────────────────────────
async function fetchMatchday(date, apiKey) {
    var _a, _b, _c, _d;
    const now = Date.now();
    let hadErrors = false;
    let fixtures = [];
    try {
        const res = await fetch(`${AF_BASE}/fixtures?date=${date}`, {
            headers: { 'x-apisports-key': apiKey },
        });
        if (res.status === 429 || !res.ok) {
            console.warn(`[apiFootballFetch] HTTP ${res.status} for date=${date}`);
            hadErrors = true;
        }
        else {
            const json = await res.json();
            // api-football returns errors as an object (non-empty = problem)
            const errors = json.errors;
            if (errors && typeof errors === 'object' && Object.keys(errors).length > 0) {
                console.warn('[apiFootballFetch] API errors:', errors);
                hadErrors = true;
            }
            fixtures = (_a = json.response) !== null && _a !== void 0 ? _a : [];
        }
    }
    catch (err) {
        console.error('[apiFootballFetch] fetch threw:', err);
        hadErrors = true;
    }
    // Group by league ID (whitelisted only)
    const byLeague = new Map();
    for (const f of fixtures) {
        if (!ALLOWED_IDS.has(f.league.id))
            continue;
        const arr = (_b = byLeague.get(f.league.id)) !== null && _b !== void 0 ? _b : [];
        arr.push(f);
        byLeague.set(f.league.id, arr);
    }
    // Build competitions in priority order
    const competitions = [];
    for (const leagueDef of exports.LEAGUE_LIST) {
        const group = byLeague.get(leagueDef.id);
        if (!group || group.length === 0)
            continue;
        competitions.push({
            id: leagueDef.code,
            name: leagueDef.name,
            country: leagueDef.country,
            short: leagueDef.short,
            flag: leagueDef.flag,
            stage: parseRound(group[0].league.round),
            matches: group.map(f => {
                const status = mapStatus(f.fixture.status.short);
                const elapsed = f.fixture.status.elapsed;
                const minute = (elapsed != null && (status === 'LIVE' || status === 'HT')) ? elapsed : null;
                return {
                    id: String(f.fixture.id),
                    status,
                    minute,
                    kickoff: status === 'SCHEDULED' ? formatKickoff(f.fixture.date) : undefined,
                    home: mapTeam(f.teams.home, f.goals.home),
                    away: mapTeam(f.teams.away, f.goals.away),
                };
            }),
        });
    }
    const LIVE_CODES = new Set(['1H', '2H', 'ET', 'BT', 'P', 'HT']);
    const hasLive = fixtures.some(f => ALLOWED_IDS.has(f.league.id) && LIVE_CODES.has(f.fixture.status.short));
    // Pick the highest-priority featured match
    let featured = null;
    const whitelisted = fixtures.filter(f => ALLOWED_IDS.has(f.league.id));
    const tryGroups = [
        whitelisted.filter(f => LIVE_CODES.has(f.fixture.status.short)),
        whitelisted.filter(f => f.fixture.status.short === 'NS' || f.fixture.status.short === 'TBD'),
        whitelisted.filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short)),
    ];
    for (const group of tryGroups) {
        if (group.length === 0)
            continue;
        const best = group.reduce((b, m) => { var _a, _b; return ((_a = TIER[m.league.id]) !== null && _a !== void 0 ? _a : 0) >= ((_b = TIER[b.league.id]) !== null && _b !== void 0 ? _b : 0) ? m : b; });
        const status = mapStatus(best.fixture.status.short);
        const elapsed = best.fixture.status.elapsed;
        const minute = (elapsed != null && (status === 'LIVE' || status === 'HT')) ? elapsed : null;
        featured = {
            id: String(best.fixture.id),
            status,
            minute,
            kickoff: status === 'SCHEDULED' ? formatKickoff(best.fixture.date) : undefined,
            competition: (_d = (_c = LEAGUE_BY_ID.get(best.league.id)) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : best.league.name,
            home: mapTeam(best.teams.home, best.goals.home),
            away: mapTeam(best.teams.away, best.goals.away),
        };
        break;
    }
    return {
        competitions,
        featured,
        hadErrors,
        hasLive,
        fetchedAt: now,
        nextFetchAfter: calcNextFetch(date, hasLive, hadErrors, now),
        aiBrief: null,
        aiBriefGeneratedAt: 0,
    };
}
//# sourceMappingURL=apiFootballFetch.js.map