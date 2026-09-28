// backend/services/totp.js
// two factor auth with an authenticator app (google authenticator, authy...) + backup codes
const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const { authenticator } = require("otplib");
const { User } = require("../db");
const { encrypt, decrypt } = require("../utils/crypto");

// accept the previous / next 30s code too, phone clocks drift
authenticator.options = { window: 1 };

const ISSUER = "PayTM";
const BACKUP_CODE_COUNT = 10;

const startSetup = async (user) => {
    const secret = authenticator.generateSecret();
    await User.updateOne({ _id: user._id }, { twoFactorPendingSecret: encrypt(secret) });
    const otpauth = authenticator.keyuri(user.username, ISSUER, secret);
    return { otpauth, qr: await QRCode.toDataURL(otpauth), secret };
};

// returns the 30s time step the code belongs to, or null.
// a step at or before lastStep was already used: codes can't be replayed
const checkCode = (encryptedSecret, code, lastStep) => {
    if (!encryptedSecret || typeof code !== "string" || !/^\d{6}$/.test(code)) {
        return null;
    }
    const delta = authenticator.checkDelta(code, decrypt(encryptedSecret));
    if (delta === null) {
        return null;
    }
    const step = Math.floor(Date.now() / 30000) + delta;
    if (lastStep && step <= lastStep) {
        return null;
    }
    return step;
};

// stores the step only if it is newer, so two parallel requests can't both use one code
const useStep = async (userId, step) => {
    const result = await User.updateOne(
        { _id: userId, $or: [{ totpLastStep: { $exists: false } }, { totpLastStep: { $lt: step } }] },
        { totpLastStep: step }
    );
    return result.modifiedCount === 1;
};

const normalizeBackupCode = (code) => String(code || "").toLowerCase().replace(/[^a-f0-9]/g, "");

const newBackupCodes = async () => {
    const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => {
        const hex = crypto.randomBytes(5).toString("hex");
        return `${hex.slice(0, 5)}-${hex.slice(5)}`;
    });
    const hashes = await Promise.all(codes.map(c => bcrypt.hash(normalizeBackupCode(c), 10)));
    return { codes, hashes };
};

// each backup code works once: the matching hash is pulled out atomically
const useBackupCode = async (user, code) => {
    const normalized = normalizeBackupCode(code);
    if (normalized.length !== 10) return false;
    for (const hash of user.twoFactorBackupCodes || []) {
        if (await bcrypt.compare(normalized, hash)) {
            const result = await User.updateOne({ _id: user._id, twoFactorBackupCodes: hash }, { $pull: { twoFactorBackupCodes: hash } });
            return result.modifiedCount === 1;
        }
    }
    return false;
};

// authenticator code first, then backup code. true if the user proved the second factor
const verifySecondFactor = async (user, code) => {
    const step = checkCode(user.twoFactorSecret, String(code || "").replace(/\s/g, ""), user.totpLastStep);
    if (step !== null) {
        return useStep(user._id, step);
    }
    return useBackupCode(user, code);
};

// short lived proof that the password was right, exchanged for real tokens after the code
const MFA_AUDIENCE = "paytm-mfa";
const signMfaToken = (userId) => jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: "5m",
    issuer: "paytm-api",
    audience: MFA_AUDIENCE
});
const verifyMfaToken = (token) => jwt.verify(token, process.env.JWT_SECRET, {
    issuer: "paytm-api",
    audience: MFA_AUDIENCE
});

module.exports = {
    startSetup,
    checkCode,
    useStep,
    newBackupCodes,
    verifySecondFactor,
    signMfaToken,
    verifyMfaToken
};
