// backend/rateLimit.js
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { verifyMfaToken } = require("./services/totp");
const crypto = require("node:crypto");

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

// guessing 2fa codes: 5 wrong codes per account per 15 minutes
const mfaLimiter = rateLimit({
    ...common,
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        try {
            return "mfa:" + verifyMfaToken(String(req.body?.mfaToken)).userId;
        } catch {
            return ipKeyGenerator(req.ip);
        }
    },
    message: message("Too many wrong codes, please try again in 15 minutes")
});

// signed in security actions (pin, 2fa, resend email): per user, so people behind the same
// ip (office, college wifi, mobile carrier nat) don't use up each other's attempts.
// runs after authMiddleware
const accountLimiter = rateLimit({
    ...common,
    windowMs: 15 * 60 * 1000,
    limit: 15,
    keyGenerator: (req) => "acct:" + String(req.userId),
    message: message("Too many attempts, please try again in 15 minutes")
});

// every open tab refreshes about every 15 minutes, so this is keyed on the refresh cookie
// (not the ip) and generous. it only stops a client stuck in a refresh loop
const refreshLimiter = rateLimit({
    ...common,
    windowMs: 15 * 60 * 1000,
    limit: 30,
    keyGenerator: (req) => {
        const cookie = req.cookies?.refresh_token;
        return cookie
            ? "refresh:" + crypto.createHash("sha256").update(cookie).digest("hex")
            : ipKeyGenerator(req.ip);
    },
    message: message("Too many attempts, please try again in 15 minutes")
});

// asking people for money: stops one user spamming requests. runs after authMiddleware
const requestLimiter = rateLimit({
    ...common,
    windowMs: 60 * 60 * 1000,
    limit: 30,
    keyGenerator: (req) => "req:" + String(req.userId),
    message: message("Too many requests sent, please try again later")
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
    mfaLimiter,
    accountLimiter,
    refreshLimiter,
    requestLimiter,
    transferLimiter
}
