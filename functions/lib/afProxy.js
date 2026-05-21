"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.afProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const apiFootballFetch_1 = require("./apiFootballFetch");
const AF_BASE = 'https://v3.football.api-sports.io';
exports.afProxy = (0, https_1.onRequest)({ secrets: [apiFootballFetch_1.afApiKey], cors: true }, async (req, res) => {
    const path = req.path.replace(/^\/api\/af/, '') || '/';
    const params = new URLSearchParams(req.query);
    const qs = params.toString() ? `?${params}` : '';
    try {
        const upstream = await fetch(`${AF_BASE}${path}${qs}`, {
            headers: { 'x-apisports-key': apiFootballFetch_1.afApiKey.value() },
        });
        const data = await upstream.json();
        res.status(upstream.status).json(data);
    }
    catch (err) {
        console.error('[afProxy] error', err);
        res.status(502).json({ error: 'upstream error' });
    }
});
//# sourceMappingURL=afProxy.js.map