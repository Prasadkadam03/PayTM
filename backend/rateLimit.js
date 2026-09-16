// backend/rateLimit.js
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const message = (text) => ({ message: text });

const common = {
    standardHeaders: "draft-8",
    legacyHeaders: false,
};

// signin / signup / password reset from one ip: slows down spam and credential stuffing
const authLimiter = rateLimit({
    ...common,
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: message("Too many attempts, please try again in 15 minutes")
});

// password guessing against one account, keyed on ip + email so one user can't lock out another
const signinLimiter = rateLimit({
    ...common,
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.username || "").trim().toLowerCase()}`,
    message: message("Too many failed sign in attempts, please try again in 15 minutes")
});

// transfers are limited per user, so it must run after authMiddleware
const transferLimiter = rateLimit({
    ...common,
    windowMs: 60 * 1000,
    limit: 10,
    keyGenerator: (req) => String(req.userId),
    message: message("Too many transfers, please wait a minute")
});

module.exports = {
    authLimiter,
    signinLimiter,
    transferLimiter
}
