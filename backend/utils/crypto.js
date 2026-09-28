// backend/utils/crypto.js
// AES-256-GCM for secrets we must be able to read back (the totp secret)
const crypto = require("node:crypto");

let warned = false;

// TOTP_ENC_KEY = 64 hex chars (32 bytes). in development a key derived from JWT_SECRET is used
const key = () => {
    const hex = process.env.TOTP_ENC_KEY;
    if (hex && /^[a-f\d]{64}$/i.test(hex)) {
        return Buffer.from(hex, "hex");
    }
    if (process.env.NODE_ENV === "production") {
        throw new Error("TOTP_ENC_KEY must be 64 hex characters in production");
    }
    if (!warned) {
        console.warn("warning: TOTP_ENC_KEY not set, deriving one from JWT_SECRET (development only)");
        warned = true;
    }
    return crypto.createHash("sha256").update("totp:" + process.env.JWT_SECRET).digest();
};

// output: iv.tag.ciphertext, all base64url
const encrypt = (plain) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map(b => b.toString("base64url")).join(".");
};

const decrypt = (payload) => {
    const [iv, tag, data] = payload.split(".").map(p => Buffer.from(p, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
};

module.exports = { encrypt, decrypt };
