// backend/services/transfer.js
// the one place that moves money between wallets. transfers, request payments and
// split payments all go through transferMoney so the rules live in one spot
const mongoose = require("mongoose");
const { Account, Transaction } = require("../db");

// a business rule failure (4xx), as opposed to a database error
class TransferError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

/**
 * moves `amount` paise from one user to another inside a single mongo transaction.
 * `inTransaction(session, transaction)` lets a caller do extra writes that must commit
 * or roll back together with the money (e.g. marking a request as paid).
 */
const transferMoney = async ({ fromUserId, toUserId, amount, note, type = "transfer", inTransaction }) => {
    if (String(toUserId) === String(fromUserId)) {
        throw new TransferError("You cannot send money to yourself");
    }

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
                note: note || undefined
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

module.exports = { transferMoney, TransferError };
