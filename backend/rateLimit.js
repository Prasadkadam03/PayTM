// backend/rateLimit.js
const { rateLimit } = require("express-rate-limit");

const message = (text) => ({ message: text });

// signin / signup: slow down password guessing and account spam
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: message("Too many attempts, please try again in 15 minutes")
});

// transfers are limited per user, so it must run after authMiddleware
const transferLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => String(req.userId),
    message: message("Too many transfers, please wait a minute")
});

module.exports = {
    authLimiter,
    transferLimiter
}
