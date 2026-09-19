// backend/utils/oneTimeToken.js
// single use tokens for email links (verify email, reset password). only the hash is stored
const crypto = require("node:crypto");
const { OneTimeToken } = require("../db");

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

const createToken = async (userId, purpose, ttlMs) => {
    const token = crypto.randomBytes(32).toString("base64url");
    await OneTimeToken.create({
        userId,
        purpose,
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + ttlMs)
    });
    return token;
};

// marks the token used and returns it, or null if it is unknown, expired or already used.
// done in one update so the same link can't be used twice in parallel
const consumeToken = (token, purpose) => {
    if (typeof token !== "string" || token.length > 100) {
        return null;
    }
    return OneTimeToken.findOneAndUpdate(
        { tokenHash: hash(token), purpose, usedAt: null, expiresAt: { $gt: new Date() } },
        { usedAt: new Date() },
        { new: true }
    );
};

// e.g. requesting a new reset link cancels the older ones
const cancelTokens = (userId, purpose) => OneTimeToken.updateMany(
    { userId, purpose, usedAt: null },
    { usedAt: new Date() }
);

module.exports = { createToken, consumeToken, cancelTokens };
