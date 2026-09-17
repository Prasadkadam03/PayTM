// backend/utils/audit.js
const { AuditLog } = require("../db");

// records a security event. never throws: a failed audit write must not break the request
const audit = async (req, event, { userId, meta } = {}) => {
    try {
        await AuditLog.create({
            userId: userId || req?.userId,
            event,
            ip: req?.ip,
            userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 300),
            meta
        });
    } catch (err) {
        console.error("audit write failed", event, err.message);
    }
};

module.exports = { audit };
