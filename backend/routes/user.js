// backend/routes/user.js
const express = require('express');
const router = express.Router();
const zod = require("zod");
const { User, Account, AuditLog, Session, isEmailVerified } = require("../db");
const { createToken, consumeToken, cancelTokens } = require("../utils/oneTimeToken");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../services/mail");
const { audit } = require("../utils/audit");
const { authMiddleware } = require("../middleware");
const { startSession, rotateSession, revokeSession, revokeAllSessions, clearRefreshCookie, RefreshError } = require("../utils/session");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { asyncHandler } = require("../utils/asyncHandler");
const { authLimiter, signinLimiter } = require("../rateLimit");

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 15 * 60 * 1000;

const passwordRule = zod.string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long")
    .regex(/[a-zA-Z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number");

const signupBody = zod.object({
    username: zod.string().trim().toLowerCase().email("Enter a valid email").max(254, "Email is too long"),
    firstName: zod.string().trim().min(1, "First name is required").max(50),
    lastName: zod.string().trim().min(1, "Last name is required").max(50),
    password: passwordRule
})

router.post("/signup", authLimiter, asyncHandler(async (req, res) => {
    const parsed = signupBody.safeParse(req.body)
    if (!parsed.success) {
        return res.status(400).json({
            message: parsed.error.issues[0].message
        })
    }
    const { username, firstName, lastName, password } = parsed.data;

    const existingUser = await User.findOne({
        username
    })

    if (existingUser) {
        return res.status(409).json({
            message: "An account with this email already exists"
        })
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // user and account are created together so we never end up with a user without a wallet
    const session = await mongoose.startSession();
    let userId;
    try {
        await session.withTransaction(async () => {
            const [user] = await User.create([{
                username,
                password: hashedPassword,
                firstName,
                lastName,
                emailVerified: false,
            }], { session })
            userId = user._id;

            await Account.create([{
                userId,
                balance: 100000 // every user gets ₹1000 (in paise) as signup.. we have lot of money 🥱
            }], { session })
        });
    } finally {
        await session.endSession();
    }

    const token = await startSession(req, res, userId);
    await audit(req, "signup", { userId });
    await sendVerificationEmail({ username, firstName }, await createToken(userId, "verify_email", VERIFY_TTL_MS));

    res.json({
        message: "User created successfully",
        token: token
    })
}))


const signinBody = zod.object({
    username: zod.string().email(),
    password: zod.string()
})

router.post("/signin", authLimiter, signinLimiter, asyncHandler(async (req, res) => {
    const { success } = signinBody.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            message: "Enter a valid email and password"
        })
    }

    const user = await User.findOne({
        username: req.body.username,
    });

    const match = user && await bcrypt.compare(req.body.password, user.password);
    if (!match) {
        if (user) {
            await audit(req, "signin_failed", { userId: user._id });
        }
        return res.status(401).json({
            message: "Invalid email or password"
        });
    }

    const token = await startSession(req, res, user._id);
    await audit(req, "signin", { userId: user._id });

    res.json({
        token: token
    })
}))

const updateBody = zod.object({
    password: zod.string().optional(),
    firstName: zod.string().optional(),
    lastName: zod.string().optional(),
})

router.put("/", authMiddleware, asyncHandler(async (req, res) => {
    const { success, data } = updateBody.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            message: "Error while updating information"
        })
    }

    if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
    }

    await User.updateOne({ _id: req.userId }, data)

    res.json({
        message: "Updated successfully"
    })
}))

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/bulk", authMiddleware, asyncHandler(async (req, res) => {
    const filter = escapeRegex(String(req.query.filter || "").trim().slice(0, 50));
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const users = await User.find({
        _id: { $ne: req.userId },
        $or: [{
            firstName: {
                "$regex": filter,
                "$options": "i"
            }
        }, {
            lastName: {
                "$regex": filter,
                "$options": "i"
            }
        }]
    })
        .select("firstName lastName")
        .limit(limit)

    res.json({
        users: users.map(user => ({
            firstName: user.firstName,
            lastName: user.lastName,
            _id: user._id
        }))
    })
}))

router.get("/getUser", authMiddleware, asyncHandler(async (req, res) => {
    const user = await User.findOne({
        _id: req.userId
    });

    if (!user) {
        return res.status(404).json({
            message: "User not found"
        });
    }

    res.json({
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        emailVerified: isEmailVerified(user)
    });
}));

router.post("/verify-email", authLimiter, asyncHandler(async (req, res) => {
    const record = await consumeToken(req.body?.token, "verify_email");
    if (!record) {
        return res.status(400).json({ message: "This link is invalid or has expired" });
    }
    await User.updateOne({ _id: record.userId }, { emailVerified: true });
    await audit(req, "email_verified", { userId: record.userId });
    res.json({ message: "Email verified" });
}));

router.post("/verify-email/resend", authMiddleware, authLimiter, asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    if (isEmailVerified(user)) {
        return res.json({ message: "Email already verified" });
    }
    await cancelTokens(user._id, "verify_email");
    await sendVerificationEmail(user, await createToken(user._id, "verify_email", VERIFY_TTL_MS));
    res.json({ message: "Verification email sent" });
}));

// always the same answer, so this can't be used to find out which emails have accounts
router.post("/password/forgot", authLimiter, asyncHandler(async (req, res) => {
    const parsed = zod.object({ username: zod.string().trim().toLowerCase().email() }).safeParse(req.body);
    const reply = { message: "If an account exists for that email, a reset link is on its way" };
    if (!parsed.success) {
        return res.json(reply);
    }

    const user = await User.findOne({ username: parsed.data.username });
    if (user) {
        await cancelTokens(user._id, "reset_password");
        await sendPasswordResetEmail(user, await createToken(user._id, "reset_password", RESET_TTL_MS));
        await audit(req, "password_reset_requested", { userId: user._id });
    }
    res.json(reply);
}));

router.post("/password/reset", authLimiter, asyncHandler(async (req, res) => {
    const parsed = zod.object({ token: zod.string().max(100), password: passwordRule }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const record = await consumeToken(parsed.data.token, "reset_password");
    if (!record) {
        return res.status(400).json({ message: "This link is invalid or has expired" });
    }

    await User.updateOne({ _id: record.userId }, { password: await bcrypt.hash(parsed.data.password, 12) });
    // whoever had the old password may still be signed in somewhere
    await revokeAllSessions(record.userId, "password_reset");
    await audit(req, "password_reset", { userId: record.userId });
    res.json({ message: "Password updated, please sign in" });
}));

// new access token from the refresh cookie. the cookie is rotated every time
router.post("/refresh", authLimiter, asyncHandler(async (req, res) => {
    try {
        const { accessToken } = await rotateSession(req, res);
        res.json({ token: accessToken });
    } catch (err) {
        if (err instanceof RefreshError) {
            return res.status(401).json({ message: err.message });
        }
        throw err;
    }
}));

router.post("/logout", authMiddleware, asyncHandler(async (req, res) => {
    if (req.sessionId) {
        await revokeSession(req.sessionId, req.userId);
    }
    clearRefreshCookie(res);
    await audit(req, "logout");
    res.json({ message: "Signed out" });
}));

router.post("/logout-all", authMiddleware, asyncHandler(async (req, res) => {
    await revokeAllSessions(req.userId, "logout_all");
    clearRefreshCookie(res);
    await audit(req, "logout_all");
    res.json({ message: "Signed out of all devices" });
}));

router.get("/sessions", authMiddleware, asyncHandler(async (req, res) => {
    const sessions = await Session.find({ userId: req.userId, revokedAt: null, expiresAt: { $gt: new Date() } })
        .sort({ lastUsedAt: -1 })
        .select("userAgent ip lastUsedAt createdAt")
        .lean();

    res.json({
        sessions: sessions.map(s => ({
            ...s,
            current: String(s._id) === String(req.sessionId)
        }))
    });
}));

router.delete("/sessions/:id", authMiddleware, asyncHandler(async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
        return res.status(400).json({ message: "Invalid session" });
    }
    const result = await revokeSession(req.params.id, req.userId, "revoked");
    if (result.modifiedCount !== 1) {
        return res.status(404).json({ message: "Session not found" });
    }
    await audit(req, "session_revoked", { meta: { sessionId: req.params.id } });
    res.json({ message: "Session signed out" });
}));

// the signed in user's own security events, newest first
router.get("/activity", authMiddleware, asyncHandler(async (req, res) => {
    const events = await AuditLog.find({ userId: req.userId })
        .sort({ _id: -1 })
        .limit(50)
        .select("event ip userAgent meta createdAt")
        .lean();

    res.json({ events });
}));

router.get("/cron", async (req, res) => {

    res.json({
        msg : "successfull"
    });
});

module.exports = router;