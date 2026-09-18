// backend/utils/session.js
// refresh tokens: random, stored hashed, sent only as an httpOnly cookie, rotated on every use
const crypto = require("crypto");
const { Session } = require("../db");
const { signToken } = require("../middleware");
const { audit } = require("./audit");

const COOKIE_NAME = "refresh_token";
const COOKIE_PATH = "/api/v1/user";
// a token rotated this recently is treated as a race between two tabs, not as theft
const REUSE_GRACE_MS = Number(process.env.REFRESH_REUSE_GRACE_MS ?? 30 * 1000);

const refreshDays = () => Number(process.env.REFRESH_TOKEN_DAYS) || 7;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: COOKIE_PATH,
    maxAge: refreshDays() * 24 * 60 * 60 * 1000
});

const setRefreshCookie = (res, token) => res.cookie(COOKIE_NAME, token, cookieOptions());

const clearRefreshCookie = (res) => {
    const { maxAge, ...options } = cookieOptions();
    res.clearCookie(COOKIE_NAME, options);
};

const newRefreshToken = () => crypto.randomBytes(32).toString("base64url");

// signs the user in on this device: new session row + refresh cookie. returns the access token
const startSession = async (req, res, userId) => {
    const refreshToken = newRefreshToken();
    const session = await Session.create({
        userId,
        tokenHash: hashToken(refreshToken),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
        ip: req.ip,
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + refreshDays() * 24 * 60 * 60 * 1000)
    });
    setRefreshCookie(res, refreshToken);
    return signToken(userId, session._id);
};

class RefreshError extends Error {}

// swaps a refresh token for a new one + a new access token
const rotateSession = async (req, res) => {
    const presented = req.cookies?.[COOKIE_NAME];
    if (!presented) {
        throw new RefreshError("Please sign in");
    }

    const tokenHash = hashToken(presented);
    const session = await Session.findOne({ tokenHash });

    if (!session || session.expiresAt < new Date()) {
        clearRefreshCookie(res);
        throw new RefreshError("Please sign in");
    }

    if (session.revokedAt) {
        clearRefreshCookie(res);
        const rotatedJustNow = session.revokedReason === "rotated"
            && Date.now() - session.revokedAt.getTime() < REUSE_GRACE_MS;
        if (session.revokedReason === "rotated" && !rotatedJustNow) {
            // an old token came back: someone kept a copy. end every session of this user
            await revokeAllSessions(session.userId, "reuse_detected");
            await audit(req, "refresh_token_reuse", { userId: session.userId });
        }
        throw new RefreshError("Please sign in");
    }

    const refreshToken = newRefreshToken();
    // only one request can win the rotation of a given token
    const rotated = await Session.findOneAndUpdate(
        { _id: session._id, tokenHash, revokedAt: null },
        { tokenHash: hashToken(refreshToken), lastUsedAt: new Date(), ip: req.ip },
        { new: true }
    );
    if (!rotated) {
        throw new RefreshError("Please sign in");
    }

    // keep the old hash around as a revoked marker so a replay of it can be detected
    await Session.create({
        userId: session.userId,
        tokenHash,
        expiresAt: session.expiresAt,
        revokedAt: new Date(),
        revokedReason: "rotated"
    });

    setRefreshCookie(res, refreshToken);
    return { userId: session.userId, accessToken: signToken(session.userId, rotated._id) };
};

const revokeSession = (sessionId, userId, reason = "logout") => Session.updateOne(
    { _id: sessionId, userId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: reason }
);

const revokeAllSessions = (userId, reason = "logout_all", exceptSessionId) => Session.updateMany(
    { userId, revokedAt: null, ...(exceptSessionId ? { _id: { $ne: exceptSessionId } } : {}) },
    { revokedAt: new Date(), revokedReason: reason }
);

module.exports = {
    COOKIE_NAME,
    RefreshError,
    startSession,
    rotateSession,
    revokeSession,
    revokeAllSessions,
    clearRefreshCookie
};
