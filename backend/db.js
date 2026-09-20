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
    emailVerified: Boolean
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

// history is read newest first for one user, as sender or receiver
transactionSchema.index({ from: 1, _id: -1 });
transactionSchema.index({ to: 1, _id: -1 });

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

module.exports = {
    isEmailVerified,
    OneTimeToken,
	User,
    Account,
    Transaction,
    AuditLog,
    Session
};

