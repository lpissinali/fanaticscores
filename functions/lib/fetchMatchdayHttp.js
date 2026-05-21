"use strict";
/**
 * HTTP Cloud Function -- on-demand fetch for non-today dates.
 * Called by the client when a past/future date is not yet in Firestore.
 * Writes to Firestore and returns the document.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMatchdayHttp = exports.anthropicApiKey = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const apiFootballFetch_1 = require("./apiFootballFetch");
const aiBrief_1 = require("./aiBrief");
const adminInit_1 = require("./adminInit");
exports.anthropicApiKey = (0, params_1.defineSecret)('ANTHROPIC_API_KEY');
const db = adminInit_1.getDb;
const inFlight = new Set();
function briefIsInvalid(doc) {
    return !doc.aiBrief || doc.aiBrief === 'No matches scheduled today.' || doc.aiBrief === 'Unable to generate brief right now.';
}
exports.fetchMatchdayHttp = (0, https_1.onRequest)({ secrets: [apiFootballFetch_1.afApiKey, exports.anthropicApiKey], cors: true, timeoutSeconds: 120 }, async (req, res) => {
    var _a, _b, _c;
    const date = (_a = req.query.date) !== null && _a !== void 0 ? _a : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'date param required (YYYY-MM-DD)' });
        return;
    }
    const now = Date.now();
    const ref = db().collection('matchdays').doc(date);
    const snap = await ref.get();
    if (snap.exists) {
        const data = snap.data();
        // Treat a doc with no competitions as stale — force a refetch.
        const hasComps = data.competitions && data.competitions.length > 0;
        if (hasComps && data.nextFetchAfter && data.nextFetchAfter > now) {
            // Doc is fresh — regenerate brief if missing or invalid.
            if (briefIsInvalid(data)) {
                console.log('[fetchMatchdayHttp] doc fresh but brief invalid -- generating');
                const briefResult = await (0, aiBrief_1.generateAiBrief)(data.competitions, data.hasLive, null, 0, exports.anthropicApiKey.value());
                if (briefResult.brief) {
                    await ref.update({ aiBrief: briefResult.brief, aiBriefGeneratedAt: briefResult.generatedAt });
                }
            }
            res.json({ cached: true });
            return;
        }
    }
    if (inFlight.has(date)) {
        res.json({ cached: false, inflight: true });
        return;
    }
    inFlight.add(date);
    try {
        console.log('[fetchMatchdayHttp] fetching ' + date);
        const newDoc = await (0, apiFootballFetch_1.fetchMatchday)(date, apiFootballFetch_1.afApiKey.value());
        let docToWrite = newDoc;
        if (newDoc.hadErrors && newDoc.competitions.length === 0 && snap.exists) {
            const existingDoc = snap.data();
            if (existingDoc.competitions && existingDoc.competitions.length > 0) {
                console.log('[fetchMatchdayHttp] rate-limited -- preserving ' + existingDoc.competitions.length + ' existing comps');
                docToWrite = Object.assign(Object.assign({}, newDoc), { competitions: existingDoc.competitions, featured: (_c = (_b = newDoc.featured) !== null && _b !== void 0 ? _b : existingDoc.featured) !== null && _c !== void 0 ? _c : null });
            }
        }
        const existingData = snap.exists ? snap.data() : null;
        const briefResult = await (0, aiBrief_1.generateAiBrief)(docToWrite.competitions, docToWrite.hasLive, existingData && !briefIsInvalid(existingData) ? existingData.aiBrief : null, existingData && !briefIsInvalid(existingData) ? existingData.aiBriefGeneratedAt : 0, exports.anthropicApiKey.value());
        docToWrite = Object.assign(Object.assign({}, docToWrite), { aiBrief: briefResult.brief, aiBriefGeneratedAt: briefResult.generatedAt });
        await ref.set(docToWrite);
        console.log('[fetchMatchdayHttp] wrote ' + date + ' comps=' + docToWrite.competitions.length + ' brief=' + !!briefResult.brief);
        res.json({ cached: false });
    }
    catch (err) {
        console.error('[fetchMatchdayHttp] error', err);
        res.status(500).json({ error: 'fetch failed' });
    }
    finally {
        inFlight.delete(date);
    }
});
//# sourceMappingURL=fetchMatchdayHttp.js.map