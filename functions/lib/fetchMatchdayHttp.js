"use strict";
/**
 * HTTP Cloud Function — on-demand fetch for non-today dates.
 * Called by the client when a past/future date is not yet in Firestore.
 * Writes to Firestore and returns the document.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMatchdayHttp = void 0;
const https_1 = require("firebase-functions/v2/https");
const footballDataFetch_1 = require("./footballDataFetch");
const adminInit_1 = require("./adminInit");
const db = adminInit_1.getDb;
// Simple in-flight dedup: prevent parallel fetches for the same date.
const inFlight = new Set();
exports.fetchMatchdayHttp = (0, https_1.onRequest)({ secrets: [footballDataFetch_1.fdApiKey], cors: true, timeoutSeconds: 120 }, async (req, res) => {
    var _a, _b, _c;
    const date = (_a = req.query.date) !== null && _a !== void 0 ? _a : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'date param required (YYYY-MM-DD)' });
        return;
    }
    const now = Date.now();
    const ref = db().collection('matchdays').doc(date);
    // Return cached doc if still fresh.
    const snap = await ref.get();
    if (snap.exists) {
        const data = snap.data();
        if (data.nextFetchAfter && data.nextFetchAfter > now) {
            res.json({ cached: true });
            return;
        }
    }
    // Deduplicate concurrent requests for same date.
    if (inFlight.has(date)) {
        res.json({ cached: false, inflight: true });
        return;
    }
    inFlight.add(date);
    try {
        console.log(`[fetchMatchdayHttp] fetching ${date}`);
        const newDoc = await (0, footballDataFetch_1.fetchMatchday)(date, footballDataFetch_1.fdApiKey.value());
        // Guard: never overwrite good competition data with an empty array caused by rate limiting.
        let docToWrite = newDoc;
        if (newDoc.hadErrors && newDoc.competitions.length === 0 && snap.exists) {
            const existing = snap.data();
            if (existing.competitions && existing.competitions.length > 0) {
                console.log(`[fetchMatchdayHttp] rate-limited with no results — preserving ${existing.competitions.length} existing comps`);
                docToWrite = Object.assign(Object.assign({}, newDoc), { competitions: existing.competitions, featured: (_c = (_b = newDoc.featured) !== null && _b !== void 0 ? _b : existing.featured) !== null && _c !== void 0 ? _c : null });
            }
        }
        await ref.set(docToWrite);
        console.log(`[fetchMatchdayHttp] wrote ${date} — comps=${docToWrite.competitions.length}`);
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