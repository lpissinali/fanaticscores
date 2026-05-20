"use strict";
/**
 * Scheduled Cloud Function -- runs every minute via Cloud Scheduler.
 * Checks whether today's Firestore doc needs refreshing and fetches if so.
 * Also generates an AI brief via Claude Haiku (rate-limited to 5 min).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledMatchFetch = exports.anthropicApiKey = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const footballDataFetch_1 = require("./footballDataFetch");
const aiBrief_1 = require("./aiBrief");
const adminInit_1 = require("./adminInit");
exports.anthropicApiKey = (0, params_1.defineSecret)('ANTHROPIC_API_KEY');
const db = adminInit_1.getDb;
exports.scheduledMatchFetch = (0, scheduler_1.onSchedule)({ schedule: 'every 1 minutes', secrets: [footballDataFetch_1.fdApiKey, exports.anthropicApiKey], timeoutSeconds: 120 }, async () => {
    var _a, _b;
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const ref = db().collection('matchdays').doc(today);
    // Check whether a fetch is due.
    const snap = await ref.get();
    if (snap.exists) {
        const data = snap.data();
        if (data.nextFetchAfter && data.nextFetchAfter > now) {
            console.log('[scheduledFetch] skipping -- next fetch not yet due');
            return;
        }
    }
    console.log('[scheduledFetch] fetching ' + today);
    const newDoc = await (0, footballDataFetch_1.fetchMatchday)(today, footballDataFetch_1.fdApiKey.value());
    // Guard: never overwrite good competition data with an empty array caused by rate limiting.
    let docToWrite = newDoc;
    if (newDoc.hadErrors && newDoc.competitions.length === 0 && snap.exists) {
        const existingDoc = snap.data();
        if (existingDoc.competitions && existingDoc.competitions.length > 0) {
            console.log('[scheduledFetch] rate-limited -- preserving ' + existingDoc.competitions.length + ' existing comps');
            docToWrite = Object.assign(Object.assign({}, newDoc), { competitions: existingDoc.competitions, featured: (_b = (_a = newDoc.featured) !== null && _a !== void 0 ? _a : existingDoc.featured) !== null && _b !== void 0 ? _b : null });
        }
    }
    // Generate AI brief (rate-limited internally to avoid excess Claude API calls).
    const existingData = snap.exists ? snap.data() : null;
    const { brief, generatedAt } = await (0, aiBrief_1.generateAiBrief)(docToWrite.competitions, docToWrite.hasLive, existingData ? existingData.aiBrief : null, existingData ? existingData.aiBriefGeneratedAt : 0, exports.anthropicApiKey.value());
    docToWrite = Object.assign(Object.assign({}, docToWrite), { aiBrief: brief, aiBriefGeneratedAt: generatedAt });
    await ref.set(docToWrite);
    console.log('[scheduledFetch] wrote ' + today + ' hasLive=' + docToWrite.hasLive + ' comps=' + docToWrite.competitions.length + ' brief=' + !!brief);
});
//# sourceMappingURL=scheduledFetch.js.map