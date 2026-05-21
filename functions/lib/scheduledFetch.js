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
const apiFootballFetch_1 = require("./apiFootballFetch");
const aiBrief_1 = require("./aiBrief");
const adminInit_1 = require("./adminInit");
function briefIsInvalid(doc) {
    return !doc.aiBrief || doc.aiBrief === 'No matches scheduled today.' || doc.aiBrief === 'Unable to generate brief right now.';
}
exports.anthropicApiKey = (0, params_1.defineSecret)('ANTHROPIC_API_KEY');
const db = adminInit_1.getDb;
exports.scheduledMatchFetch = (0, scheduler_1.onSchedule)({ schedule: 'every 1 minutes', secrets: [apiFootballFetch_1.afApiKey, exports.anthropicApiKey], timeoutSeconds: 120 }, async () => {
    var _a, _b;
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const ref = db().collection('matchdays').doc(today);
    const snap = await ref.get();
    if (snap.exists) {
        const data = snap.data();
        if (data.nextFetchAfter && data.nextFetchAfter > now) {
            if (briefIsInvalid(data)) {
                console.log('[scheduledFetch] doc fresh but brief missing/invalid -- generating');
                const briefResult = await (0, aiBrief_1.generateAiBrief)(data.competitions, data.hasLive, null, 0, exports.anthropicApiKey.value());
                if (briefResult.brief) {
                    await ref.update({ aiBrief: briefResult.brief, aiBriefGeneratedAt: briefResult.generatedAt });
                }
            }
            else {
                console.log('[scheduledFetch] skipping -- next fetch not yet due');
            }
            return;
        }
    }
    console.log('[scheduledFetch] fetching ' + today);
    const newDoc = await (0, apiFootballFetch_1.fetchMatchday)(today, apiFootballFetch_1.afApiKey.value());
    let docToWrite = newDoc;
    if (newDoc.hadErrors && newDoc.competitions.length === 0 && snap.exists) {
        const existingDoc = snap.data();
        if (existingDoc.competitions && existingDoc.competitions.length > 0) {
            console.log('[scheduledFetch] rate-limited -- preserving ' + existingDoc.competitions.length + ' existing comps');
            docToWrite = Object.assign(Object.assign({}, newDoc), { competitions: existingDoc.competitions, featured: (_b = (_a = newDoc.featured) !== null && _a !== void 0 ? _a : existingDoc.featured) !== null && _b !== void 0 ? _b : null });
        }
    }
    const existingData = snap.exists ? snap.data() : null;
    const briefResult = await (0, aiBrief_1.generateAiBrief)(docToWrite.competitions, docToWrite.hasLive, existingData && !briefIsInvalid(existingData) ? existingData.aiBrief : null, existingData && !briefIsInvalid(existingData) ? existingData.aiBriefGeneratedAt : 0, exports.anthropicApiKey.value());
    docToWrite = Object.assign(Object.assign({}, docToWrite), { aiBrief: briefResult.brief, aiBriefGeneratedAt: briefResult.generatedAt });
    await ref.set(docToWrite);
    console.log('[scheduledFetch] wrote ' + today + ' hasLive=' + docToWrite.hasLive + ' comps=' + docToWrite.competitions.length + ' brief=' + !!briefResult.brief);
});
//# sourceMappingURL=scheduledFetch.js.map