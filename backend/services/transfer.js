// backend/services/transfer.js
// the one place that moves money between wallets. transfers, request payments and
// split payments all go through transferMoney so the rules live in one spot
const mongoose = require("mongoose");
const { Account, Transaction, User, isEmailVerified } = require("../db");
const { verifyPin, PinError } = require("./pin");

// a business rule failure (4xx), as opposed to a database error
class TransferError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

// checks run before any money moves on behalf of this user: verified email + correct pin
const assertCanSend = async (req, userId, pin) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new TransferError("Please sign in", 401);
    }
    if (!isEmailVerified(user)) {
        throw new TransferError("Verify your email before sending money", 403);
    }
    try {
        await verifyPin(req, user, pin);
    } catch (err) {
        if (err instanceof PinError) {
            throw new TransferError(err.message, err.status);
        }
        throw err;
    }
    return user;
};

/**
 * moves `amount` paise from one user to another inside a single mongo transaction.
 * `inTransaction(session, transaction)` lets a caller do extra writes that must commit
 * or roll back together with the money (e.g. marking a request as paid).
 */
const transferMoney = async ({ fromUserId, toUserId, amount, note, type = "transfer", idempotencyKey, inTransaction }) => {
    if (String(toUserId) === String(fromUserId)) {
        throw new TransferError("You cannot send money to yourself");
    }

    try {
        return await moveMoney({ fromUserId, toUserId, amount, note, type, idempotencyKey, inTransaction });
    } catch (err) {
        // a parallel request with the same key committed first: answer with its result
        if (idempotencyKey && err.code === 11000 && err.keyPattern?.idempotencyKey) {
            const replay = await findReplay(fromUserId, idempotencyKey, { toUserId, amount });
            if (replay) return replay;
        }
        throw err;
    }
};

// the earlier result for this Idempotency-Key, or null if the key is new.
// the same key with different details is a client bug, not a retry
const findReplay = async (fromUserId, idempotencyKey, { toUserId, amount }) => {
    if (!idempotencyKey) return null;
    const existing = await Transaction.findOne({ from: fromUserId, idempotencyKey });
    if (!existing) return null;
    if (String(existing.to) !== String(toUserId) || existing.amount !== amount) {
        throw new TransferError("This Idempotency-Key was already used for a different payment", 409);
    }
    return { transaction: existing, replay: true };
};

const moveMoney = async ({ fromUserId, toUserId, amount, note, type, idempotencyKey, inTransaction }) => {
    const session = await mongoose.startSession();
    try {
        let transaction;

        // withTransaction retries the whole callback when two transfers touch the same
        // account at once (WriteConflict), instead of failing the user's request
        await session.withTransaction(async () => {
            const toAccount = await Account.findOne({ userId: toUserId }).session(session);

            if (!toAccount) {
                throw new TransferError("Invalid account");
            }

            // check and debit in one atomic update, so two parallel transfers can never overdraw
            const debit = await Account.updateOne(
                { userId: fromUserId, balance: { $gte: amount } },
                { $inc: { balance: -amount } }
            ).session(session);

            if (debit.modifiedCount !== 1) {
                throw new TransferError("Insufficient balance !");
            }

            await Account.updateOne({ userId: toUserId }, { $inc: { balance: amount } }).session(session);

            // the record is part of the same mongo transaction, so it exists only if the money moved
            [transaction] = await Transaction.create([{
                type,
                from: fromUserId,
                to: toUserId,
                amount,
                note: note || undefined,
                idempotencyKey: idempotencyKey || undefined
            }], { session });

            if (inTransaction) {
                await inTransaction(session, transaction);
            }
        });

        return { transaction };
    } finally {
        await session.endSession();
    }
};

module.exports = { transferMoney, findReplay, assertCanSend, TransferError };
