"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fdProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const fdApiKey = (0, params_1.defineSecret)('FD_API_KEY');
const FD_BASE = 'https://api.football-data.org/v4';
exports.fdProxy = (0, https_1.onRequest)({ secrets: [fdApiKey], cors: true }, async (req, res) => {
    // Strip /api/fd prefix that Hosting rewrite passes through
    const path = req.path.replace(/^\/api\/fd/, '') || '/';
    const params = new URLSearchParams(req.query);
    const qs = params.toString() ? `?${params}` : '';
    const upstream = await fetch(`${FD_BASE}${path}${qs}`, {
        headers: { 'X-Auth-Token': fdApiKey.value() },
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
});
//# sourceMappingURL=index.js.map