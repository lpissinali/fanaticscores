"use strict";
/**
 * Scheduled Cloud Function — runs every minute via Cloud Scheduler.
 * Checks whether today's Firestore doc needs refreshing and fetches if so.
 * Interval is data-driven: 60 s with live matches, 2 min otherwise, 30 min if no matches.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledMatchFetch = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const footballDataFetch_1 = require("./footballDataFetch");
const adminInit_1 = require("./adminInit");
const db = adminInit_1.getDb;
exports.scheduledMatchFetch = (0, scheduler_1.onSchedule)({ schedule: 'every 1 minutes', secrets: [footballDataFetch_1.fdApiKey], timeoutSeconds: 120 }, async () => {
    var _a, _b;
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const ref = db().collection('matchdays').doc(today);
    // Check whether a fetch is due.
    const snap = await ref.get();
    if (snap.exists) {
        const data = snap.data();
        if (data.nextFetchAfter && data.nextFetchAfter > now) {
            console.log(`[scheduledFetch] skipping — next fetch due in ${Math.round((data.nextFetchAfter - now) / 1000)}s`);
            return;
        }
    }
    console.log(`[scheduledFetch] fetching ${today}`);
    const newDoc = await (0, footballDataFetch_1.fetchMatchday)(today, footballDataFetch_1.fdApiKey.value());
    // Guard: never overwrite good competition data with an empty array caused by rate limiting.
    // If the new fetch got no competitions (all 429'd) but we have existing data, keep it.
    let docToWrite = newDoc;
    if (newDoc.hadErrors && newDoc.competitions.length === 0 && snap.exists) {
        const existing = snap.data();
        if (existing.competitions && existing.competitions.length > 0) {
            console.log(`[scheduledFetch] rate-limited with no results — preserving ${existing.competitions.length} existing comps`);
            docToWrite = Object.assign(Object.assign({}, newDoc), { competitions: existing.competitions, featured: (_b = (_a = newDoc.featured) !== null && _a !== void 0 ? _a : existing.featured) !== null && _b !== void 0 ? _b : null });
        }
    }
    await ref.set(docToWrite);
    console.log(`[scheduledFetch] wrote ${today} — hasLive=${docToWrite.hasLive} hadErrors=${docToWrite.hadErrors} comps=${docToWrite.competitions.length}`);
});
//# sourceMappingURL=scheduledFetch.js.map