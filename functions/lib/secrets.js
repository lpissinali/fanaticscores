"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.afApiKey = exports.anthropicApiKey = void 0;
const params_1 = require("firebase-functions/params");
exports.anthropicApiKey = (0, params_1.defineSecret)('ANTHROPIC_API_KEY');
exports.afApiKey = (0, params_1.defineSecret)('AF_API_KEY');
//# sourceMappingURL=secrets.js.map