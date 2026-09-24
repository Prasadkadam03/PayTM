// backend/routes/user.js
const express = require('express');
const router = express.Router();
const zod = require("zod");
const { User, Account, AuditLog, Session, isEmailVerified } = require("../db");
const { createToken, consumeToken, cancelTokens } = require("../utils/oneTimeToken");
const { sendVerificationEmail, sendPasswordResetEmail, sendNewLoginEmail } = require("../services/mail");
const { audit } = require("../utils/audit");
const { hashPin, isWeakPin } = require("../services/pin");
const { startSetup, checkCode, newBackupCodes, verifySecondFactor, signMfaToken, verifyMfaToken } = require("../services/totp");
const { authMiddleware } = require("../middleware");
const { startSession, rotateSession, revokeSession, revokeAllSessions, clearRefreshCookie, RefreshError } = require("../utils/session");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { asyncHandler } = require("../utils/asyncHandler");
const { authLimiter, signinLimiter, mfaLimiter, accountLimiter, refreshLimiter } = require("../rateLimit");

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
    username: zod.string().trim().toLowerCase().email(),
    password: zod.string().max(200)
})

router.post("/signin", authLimiter, signinLimiter, asyncHandler(async (req, res) => {
    const { success, data } = signinBody.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            message: "Enter a valid email and password"
        })
    }

    const user = await User.findOne({
        username: data.username,
    });

    const match = user && await bcrypt.compare(data.password, user.password);
    if (!match) {
        if (user) {
            await audit(req, "signin_failed", { userId: user._id });
        }
        return res.status(401).json({
            message: "Invalid email or password"
        });
    }

    // password was right, but the authenticator code is still needed
    if (user.twoFactorEnabled) {
        await audit(req, "signin_password_ok", { userId: user._id });
        return res.json({
            mfaRequired: true,
            mfaToken: signMfaToken(user._id)
        });
    }

    const token = await completeSignin(req, res, user);

    res.json({
        token: token
    })
}))

// last step of every sign in: session + audit + an email when the device is new
const completeSignin = async (req, res, user) => {
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 300);
    const knownDevice = await Session.exists({ userId: user._id, userAgent });

    const token = await startSession(req, res, user._id);
    await audit(req, "signin", { userId: user._id, meta: { newDevice: !knownDevice } });

    if (!knownDevice) {
        // not awaited: a slow mail provider must not slow down sign in
        sendNewLoginEmail(user, { ip: req.ip, userAgent, at: new Date() });
    }
    return token;
};

// name only. the password has its own route that asks for the current one
const updateBody = zod.object({
    firstName: zod.string().trim().min(1, "First name is required").max(50).optional(),
    lastName: zod.string().trim().min(1, "Last name is required").max(50).optional(),
}).strict()

router.put("/", authMiddleware, asyncHandler(async (req, res) => {
    const { success, data, error } = updateBody.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            message: error.issues[0].code === "unrecognized_keys"
                ? "Only your name can be changed here"
                : error.issues[0].message
        })
    }

    await User.updateOne({ _id: req.userId }, data)

    res.json({
        message: "Updated successfully"
    })
}))

// needs the current password. every other device is signed out afterwards
router.post("/password/change", authMiddleware, accountLimiter, asyncHandler(async (req, res) => {
    const parsed = zod.object({ currentPassword: zod.string().max(200), newPassword: passwordRule }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const user = await User.findById(req.userId);
    if (!user || !await bcrypt.compare(parsed.data.currentPassword, user.password)) {
        return res.status(403).json({ message: "Current password is wrong" });
    }

    await User.updateOne({ _id: user._id }, { password: await bcrypt.hash(parsed.data.newPassword, 12) });
    await revokeAllSessions(user._id, "password_changed", req.sessionId);
    await audit(req, "password_changed");
    res.json({ message: "Password changed, other devices were signed out" });
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
        emailVerified: isEmailVerified(user),
        hasPin: Boolean(user.pinHash),
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
        backupCodesLeft: user.twoFactorBackupCodes?.length || 0
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

router.post("/verify-email/resend", authMiddleware, accountLimiter, asyncHandler(async (req, res) => {
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

// second step of signin when 2fa is on: authenticator code or a backup code
router.post("/2fa/verify", authLimiter, mfaLimiter, asyncHandler(async (req, res) => {
    let userId;
    try {
        userId = verifyMfaToken(String(req.body?.mfaToken)).userId;
    } catch {
        return res.status(400).json({ message: "Sign in again, this step expired" });
    }

    const user = await User.findById(userId);
    if (!user?.twoFactorEnabled || !await verifySecondFactor(user, req.body?.code)) {
        await audit(req, "2fa_failed", { userId });
        return res.status(400).json({ message: "Invalid code" });
    }

    const token = await completeSignin(req, res, user);
    res.json({ token });
}));

// password + current password check shared by the sensitive 2fa endpoints
const checkPassword = async (req) => {
    const user = await User.findById(req.userId);
    const ok = user && typeof req.body?.password === "string" && await bcrypt.compare(req.body.password, user.password);
    return ok ? user : null;
};

// step 1: a new secret (stored as pending) + qr code for the authenticator app
router.post("/2fa/setup", authMiddleware, accountLimiter, asyncHandler(async (req, res) => {
    const user = await checkPassword(req);
    if (!user) {
        return res.status(403).json({ message: "Wrong password" });
    }
    if (user.twoFactorEnabled) {
        return res.status(409).json({ message: "Two factor is already on" });
    }
    res.json(await startSetup(user));
}));

// step 2: the first code from the app proves it was set up right. returns backup codes once
router.post("/2fa/enable", authMiddleware, accountLimiter, asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user?.twoFactorPendingSecret) {
        return res.status(400).json({ message: "Start the setup first" });
    }
    const step = checkCode(user.twoFactorPendingSecret, String(req.body?.code || ""), user.totpLastStep);
    if (step === null) {
        return res.status(400).json({ message: "Invalid code, check the time on your phone" });
    }

    const { codes, hashes } = await newBackupCodes();
    await User.updateOne({ _id: user._id }, {
        twoFactorEnabled: true,
        twoFactorSecret: user.twoFactorPendingSecret,
        twoFactorBackupCodes: hashes,
        totpLastStep: step,
        $unset: { twoFactorPendingSecret: 1 }
    });
    await audit(req, "2fa_enabled");
    res.json({ message: "Two factor is on", backupCodes: codes });
}));

router.post("/2fa/disable", authMiddleware, accountLimiter, asyncHandler(async (req, res) => {
    const user = await checkPassword(req);
    if (!user) {
        return res.status(403).json({ message: "Wrong password" });
    }
    if (!user.twoFactorEnabled) {
        return res.json({ message: "Two factor is already off" });
    }
    if (!await verifySecondFactor(user, req.body?.code)) {
        return res.status(400).json({ message: "Invalid code" });
    }
    await User.updateOne({ _id: user._id }, {
        twoFactorEnabled: false,
        $unset: { twoFactorSecret: 1, twoFactorPendingSecret: 1, twoFactorBackupCodes: 1, totpLastStep: 1 }
    });
    await audit(req, "2fa_disabled");
    res.json({ message: "Two factor is off" });
}));

// set or change the transaction pin. the password is asked so a stolen session can't do it
router.post("/pin", authMiddleware, accountLimiter, asyncHandler(async (req, res) => {
    const parsed = zod.object({
        password: zod.string().max(200),
        pin: zod.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits")
    }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    if (isWeakPin(parsed.data.pin)) {
        return res.status(400).json({ message: "Choose a less obvious PIN (not 1111 or 1234)" });
    }

    const user = await User.findById(req.userId);
    if (!user || !await bcrypt.compare(parsed.data.password, user.password)) {
        // 403 not 401: a wrong password here must not look like an expired session
        return res.status(403).json({ message: "Wrong password" });
    }

    const hadPin = Boolean(user.pinHash);
    await User.updateOne({ _id: user._id }, {
        pinHash: await hashPin(parsed.data.pin),
        pinFailedAttempts: 0,
        $unset: { pinLockedUntil: 1 }
    });
    await audit(req, hadPin ? "pin_changed" : "pin_set");
    res.json({ message: hadPin ? "PIN changed" : "PIN set" });
}));

// new access token from the refresh cookie. the cookie is rotated every time
router.post("/refresh", refreshLimiter, asyncHandler(async (req, res) => {
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