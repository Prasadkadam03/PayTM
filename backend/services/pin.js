// backend/services/pin.js
// transaction pin: a second secret asked on every payment, locked after repeated mistakes
const bcrypt = require("bcrypt");
const { User } = require("../db");
const { audit } = require("../utils/audit");
const { sendPinLockedEmail } = require("./mail");

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 30;

// a business rule failure with its own http status. deliberately never 401:
// the frontend treats 401 as "session expired" and would sign the user out
class PinError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

const isWeakPin = (pin) => {
    if (/^(\d)\1+$/.test(pin)) return true; // 1111, 000000
    const digits = [...pin].map(Number);
    const steps = digits.slice(1).map((d, i) => d - digits[i]);
    return steps.every(s => s === 1) || steps.every(s => s === -1); // 1234, 9876
};

const hashPin = (pin) => bcrypt.hash(pin, 10);

const verifyPin = async (req, user, pin) => {
    if (!user.pinHash) {
        throw new PinError("Set a transaction PIN before sending money", 403);
    }
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
        const minutes = Math.ceil((user.pinLockedUntil - Date.now()) / 60000);
        throw new PinError(`PIN locked, try again in ${minutes} minute${minutes === 1 ? "" : "s"}`, 423);
    }

    const ok = typeof pin === "string" && /^\d{4,6}$/.test(pin) && await bcrypt.compare(pin, user.pinHash);
    if (ok) {
        if (user.pinFailedAttempts) {
            await User.updateOne({ _id: user._id }, { pinFailedAttempts: 0 });
        }
        return;
    }

    // counted atomically so parallel wrong guesses can't skip the lock
    const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { pinFailedAttempts: 1 } },
        { new: true }
    );
    await audit(req, "pin_failed", { userId: user._id });

    if (updated.pinFailedAttempts >= MAX_ATTEMPTS) {
        await User.updateOne(
            { _id: user._id },
            { pinFailedAttempts: 0, pinLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) }
        );
        await audit(req, "pin_locked", { userId: user._id });
        sendPinLockedEmail(user, LOCK_MINUTES);
        throw new PinError(`Too many wrong attempts, PIN locked for ${LOCK_MINUTES} minutes`, 423);
    }

    const left = MAX_ATTEMPTS - updated.pinFailedAttempts;
    throw new PinError(`Wrong PIN, ${left} attempt${left === 1 ? "" : "s"} left`, 403);
};

module.exports = { verifyPin, hashPin, isWeakPin, PinError };
