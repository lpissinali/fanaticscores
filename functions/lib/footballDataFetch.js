"use strict";
/**
 * Core football-data.org fetching logic shared by scheduled + on-demand functions.
 * Returns a Firestore-ready matchday document.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMP_LIST = exports.fdApiKey = void 0;
exports.calcNextFetch = calcNextFetch;
exports.fetchMatchday = fetchMatchday;
const params_1 = require("firebase-functions/params");
exports.fdApiKey = (0, params_1.defineSecret)('FD_API_KEY');
const FD_BASE = 'https://api.football-data.org/v4';
// ── Competition list (priority order) ──────────────────────────────────────
exports.COMP_LIST = [
    { code: 'CL', name: 'UEFA Champions League', country: 'Europe', short: 'UCL', flag: '#1a3a6b' },
    { code: 'PL', name: 'Premier League', country: 'England', short: 'PL', flag: '#3d0d6b' },
    { code: 'PD', name: 'Primera Division', country: 'Spain', short: 'LL', flag: '#8b0000' },
    { code: 'SA', name: 'Serie A', country: 'Italy', short: 'SA', flag: '#003580' },
    { code: 'BL1', name: 'Bundesliga', country: 'Germany', short: 'BL', flag: '#cc0000' },
    { code: 'FL1', name: 'Ligue 1', country: 'France', short: 'L1', flag: '#003189' },
    { code: 'BSA', name: 'Campeonato Brasileiro', country: 'Brazil', short: 'BSA', flag: '#006400' },
    { code: 'ELC', name: 'Championship', country: 'England', short: 'CH', flag: '#2d0d5b' },
    { code: 'DED', name: 'Eredivisie', country: 'Netherlands', short: 'ERE', flag: '#ff6600' },
    { code: 'PPL', name: 'Primeira Liga', country: 'Portugal', short: 'PPL', flag: '#006600' },
    { code: 'WC', name: 'FIFA World Cup', country: 'World', short: 'WC', flag: '#8b6914' },
];
// ── Helpers ────────────────────────────────────────────────────────────────
const delay = (ms) => new Promise(r => setTimeout(r, ms));
function mapStatus(s) {
    switch (s) {
        case 'IN_PLAY': return 'LIVE';
        case 'PAUSED': return 'HT';
        case 'FINISHED': return 'FT';
        case 'POSTPONED': return 'POSTPONED';
        case 'CANCELLED':
        case 'SUSPENDED': return 'CANCELLED';
        default: return 'SCHEDULED';
    }
}
function formatKickoff(utcDate) {
    return new Date(utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function mapTeam(fd, score) {
    const name = fd.shortName || fd.name;
    return {
        id: String(fd.id),
        name,
        short: name.split(' ')[0],
        initial: fd.tla || name.slice(0, 3).toUpperCase(),
        color: '#3a3a48',
        crest: fd.crest || undefined,
        score,
    };
}
function formatStage(s) {
    return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
const COMP_TIER = {
    CL: 10, WC: 9, PL: 8, PD: 8, SA: 8, BL1: 7, FL1: 7,
    BSA: 5, ELC: 4, DED: 4, PPL: 4,
};
// ── TTL logic ──────────────────────────────────────────────────────────────
function calcNextFetch(date, hasLive, hadErrors, now) {
    const today = new Date().toISOString().slice(0, 10);
    if (date < today)
        return hadErrors ? now + 65000 : now + 24 * 3600000; // past: retry 65s on errors, else 24h
    if (date > today)
        return now + (hadErrors ? 65000 : 3600000); // future: 1 h or retry 65 s
    // today:
    if (hasLive)
        return now + 60000; // live match: 60 s
    if (hadErrors)
        return now + 65000; // partial: 65 s
    return now + 2 * 60000; // no live: 2 min
}
// ── Main fetch ─────────────────────────────────────────────────────────────
async function fetchMatchday(date, apiKey) {
    var _a, _b, _c, _d;
    const now = Date.now();
    const competitions = [];
    const allMatches = [];
    let hadErrors = false;
    for (let i = 0; i < exports.COMP_LIST.length; i++) {
        if (i > 0)
            await delay(350);
        const comp = exports.COMP_LIST[i];
        try {
            const res = await fetch(`${FD_BASE}/competitions/${comp.code}/matches?dateFrom=${date}&dateTo=${date}`, { headers: { 'X-Auth-Token': apiKey } });
            if (res.status === 429) {
                hadErrors = true;
                continue;
            }
            if (!res.ok)
                continue;
            const data = await res.json();
            const fdMatches = (_a = data.matches) !== null && _a !== void 0 ? _a : [];
            if (fdMatches.length === 0)
                continue;
            allMatches.push(...fdMatches);
            const stage = (_b = fdMatches[0]) === null || _b === void 0 ? void 0 : _b.stage;
            competitions.push({
                id: comp.code,
                name: comp.name,
                country: comp.country,
                short: comp.short,
                flag: comp.flag,
                stage: stage ? formatStage(stage) : undefined,
                matches: fdMatches.map(fd => {
                    const status = mapStatus(fd.status);
                    let minute = null;
                    if (fd.minute != null) {
                        minute = fd.injuryTime ? `${fd.minute}+${fd.injuryTime}` : fd.minute;
                    }
                    return {
                        id: String(fd.id),
                        status,
                        minute,
                        kickoff: status === 'SCHEDULED' ? formatKickoff(fd.utcDate) : undefined,
                        home: mapTeam(fd.homeTeam, fd.score.fullTime.home),
                        away: mapTeam(fd.awayTeam, fd.score.fullTime.away),
                    };
                }),
            });
        }
        catch ( /* network error — skip comp */_e) { /* network error — skip comp */ }
    }
    const hasLive = allMatches.some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
    // Pick featured match (highest-tier live/scheduled)
    let featured = null;
    const priority = ['IN_PLAY', 'PAUSED', 'TIMED', 'SCHEDULED', 'FINISHED'];
    for (const s of priority) {
        const candidates = allMatches.filter(m => m.status === s);
        if (candidates.length === 0)
            continue;
        const fd = candidates.reduce((best, m) => {
            var _a, _b, _c, _d, _e, _f;
            const mt = (_c = COMP_TIER[(_b = (_a = m.competition) === null || _a === void 0 ? void 0 : _a.code) !== null && _b !== void 0 ? _b : '']) !== null && _c !== void 0 ? _c : 0;
            const bt = (_f = COMP_TIER[(_e = (_d = best.competition) === null || _d === void 0 ? void 0 : _d.code) !== null && _e !== void 0 ? _e : '']) !== null && _f !== void 0 ? _f : 0;
            return mt >= bt ? m : best;
        });
        const status = mapStatus(fd.status);
        let minute = null;
        if (fd.minute != null)
            minute = fd.injuryTime ? `${fd.minute}+${fd.injuryTime}` : fd.minute;
        featured = {
            id: String(fd.id), status, minute,
            kickoff: status === 'SCHEDULED' ? formatKickoff(fd.utcDate) : undefined,
            competition: (_d = (_c = fd.competition) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : '',
            home: mapTeam(fd.homeTeam, fd.score.fullTime.home),
            away: mapTeam(fd.awayTeam, fd.score.fullTime.away),
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
    };
}
//# sourceMappingURL=footballDataFetch.js.map