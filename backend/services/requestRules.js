// backend/services/requestRules.js
// rules shared by money requests and split bills (a split is a set of requests)
const { MoneyRequest } = require("../db");

const REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_OPEN_REQUESTS = 20;

// pending requests past their date become expired. done on read, no cron needed
const expireOld = (filter) => MoneyRequest.updateMany(
    { ...filter, status: "pending", expiresAt: { $lte: new Date() } },
    { status: "expired" }
);

module.exports = { REQUEST_TTL_MS, MAX_OPEN_REQUESTS, expireOld };
