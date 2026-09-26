// backend/db.js
const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        minLength: 3,
        // emails can be up to 254 characters
        maxLength: 254
    },
    password: {
        type: String,
        required: true,
        minLength: 6
    },
    firstName: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50
    },
    // false until the email link is clicked. accounts from before verification existed
    // have no value and are treated as verified
    emailVerified: Boolean,
    // transaction pin (bcrypt), asked on every payment
    pinHash: String,
    pinFailedAttempts: {
        type: Number,
        default: 0
    },
    pinLockedUntil: Date,
    // two factor auth. secrets are aes-256-gcm encrypted, backup codes bcrypt hashed
    twoFactorEnabled: Boolean,
    twoFactorSecret: String,
    twoFactorPendingSecret: String,
    twoFactorBackupCodes: [String],
    // last used 30s step, so a code can't be used twice
    totpLastStep: Number
});

const isEmailVerified = (user) => user.emailVerified !== false;

const accountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to User model
        ref: 'User',
        required: true
    },
    // stored in paise (₹10.50 -> 1050) so money math is always exact integers
    balance: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: Number.isInteger,
            message: "balance must be a whole number of paise"
        }
    }
});

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['transfer', 'request', 'topup'],
        default: 'transfer'
    },
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // paise, same as Account.balance
    amount: {
        type: Number,
        required: true,
        min: 1,
        validate: {
            validator: Number.isInteger,
            message: "amount must be a whole number of paise"
        }
    },
    note: {
        type: String,
        trim: true,
        maxLength: 100
    },
    status: {
        type: String,
        enum: ['success', 'failed'],
        default: 'success'
    }
}, { timestamps: true });

// same Idempotency-Key from the same sender = the same payment, even if retried in parallel
transactionSchema.add({ idempotencyKey: String });
transactionSchema.index(
    { from: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

// history is read newest first for one user, as sender or receiver
transactionSchema.index({ from: 1, _id: -1 });
transactionSchema.index({ to: 1, _id: -1 });

// "please pay me": from = the requester, to = the person asked to pay
const moneyRequestSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // paise
    amount: {
        type: Number,
        required: true,
        min: 1,
        validate: {
            validator: Number.isInteger,
            message: "amount must be a whole number of paise"
        }
    },
    note: {
        type: String,
        trim: true,
        maxLength: 100
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'declined', 'cancelled', 'expired'],
        default: 'pending'
    },
    expiresAt: {
        type: Date,
        required: true
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },
    splitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Split'
    }
}, { timestamps: true });

moneyRequestSchema.index({ to: 1, status: 1, _id: -1 });
moneyRequestSchema.index({ from: 1, status: 1, _id: -1 });

// one bill shared with friends. the creator already paid, everyone else gets a MoneyRequest
const splitSchema = new mongoose.Schema({
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // paise
    total: {
        type: Number,
        required: true,
        min: 1
    },
    creatorShare: {
        type: Number,
        required: true,
        min: 0
    },
    note: {
        type: String,
        trim: true,
        maxLength: 100
    },
    participants: [{
        _id: false,
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        share: {
            type: Number,
            required: true,
            min: 1
        },
        requestId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MoneyRequest'
        }
    }]
}, { timestamps: true });

const oneTimeTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    purpose: {
        type: String,
        enum: ['verify_email', 'reset_password'],
        required: true
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    usedAt: Date
}, { timestamps: true });

oneTimeTokenSchema.index({ userId: 1, purpose: 1 });
oneTimeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

// one row per signed in device. only a hash of the refresh token is stored
const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true
    },
    userAgent: String,
    ip: String,
    lastUsedAt: Date,
    expiresAt: {
        type: Date,
        required: true
    },
    revokedAt: Date,
    // rotated = replaced by a newer token, anything else = ended on purpose
    revokedReason: String
}, { timestamps: true });

// mongo deletes sessions a day after they expire
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

// security events. the app only ever inserts into this collection, never updates or deletes
const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    event: {
        type: String,
        required: true
    },
    ip: String,
    userAgent: String,
    meta: mongoose.Schema.Types.Mixed
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ userId: 1, _id: -1 });

const Account = mongoose.model('Account', accountSchema);
const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);
const Session = mongoose.model('Session', sessionSchema);
const OneTimeToken = mongoose.model('OneTimeToken', oneTimeTokenSchema);
const MoneyRequest = mongoose.model('MoneyRequest', moneyRequestSchema);
const Split = mongoose.model('Split', splitSchema);

module.exports = {
    isEmailVerified,
    OneTimeToken,
    MoneyRequest,
    Split,
	User,
    Account,
    Transaction,
    AuditLog,
    Session
};

