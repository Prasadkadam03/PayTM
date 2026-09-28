const jwt = require("jsonwebtoken");

const ISSUER = "paytm-api";
const AUDIENCE = "paytm-web";

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Please sign in" });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = verifyAccessToken(token);

        req.userId = decoded.userId;
        req.sessionId = decoded.sid;

        next();
    } catch (err) {
        const message = err.name === "TokenExpiredError"
            ? "Session expired, please sign in again"
            : "Please sign in";
        return res.status(401).json({ message });
    }
};

// short lived access token. sid ties it to the refresh session it came from
const signToken = (userId, sessionId) => jwt.sign(
    { userId: String(userId), sid: sessionId ? String(sessionId) : undefined },
    process.env.JWT_SECRET,
    {
        expiresIn: process.env.JWT_EXPIRES_IN || "15m",
        issuer: ISSUER,
        audience: AUDIENCE
    }
);

const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE
});

module.exports = {
    authMiddleware,
    signToken,
    verifyAccessToken
}
