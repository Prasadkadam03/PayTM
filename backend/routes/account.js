// backend/routes/account.js
const express = require('express');
const { authMiddleware } = require('../middleware');
const { Account, Transaction } = require('../db');
const { default: mongoose } = require('mongoose');
const zod = require("zod");
const { asyncHandler } = require("../utils/asyncHandler");
const { transferLimiter } = require("../rateLimit");

const router = express.Router();

router.get("/balance", authMiddleware, asyncHandler(async (req, res) => {
    const account = await Account.findOne({
        userId: req.userId
    });

    if (!account) {
        return res.status(404).json({
            message: "Account not found"
        });
    }

    res.json({
        balance: account.balance
    })
}));

const transferBody = zod.object({
    to: zod.string().regex(/^[a-f\d]{24}$/i, "Invalid account"),
    // amount is in paise
    amount: zod.number().int("Invalid amount").positive("Invalid amount").max(Number.MAX_SAFE_INTEGER)
})

router.post("/transfer", authMiddleware, transferLimiter, asyncHandler(async (req, res) => {
    const parsed = transferBody.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: parsed.error.issues[0].message
        });
    }
    const { amount, to } = parsed.data;

    if (to === String(req.userId)) {
        return res.status(400).json({
            message: "You cannot send money to yourself"
        });
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const toAccount = await Account.findOne({ userId: to }).session(session);

        if (!toAccount) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Invalid account"
            });
        }

        // check and debit in one atomic update, so two parallel transfers can never overdraw
        const debit = await Account.updateOne(
            { userId: req.userId, balance: { $gte: amount } },
            { $inc: { balance: -amount } }
        ).session(session);

        if (debit.modifiedCount !== 1) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Insufficient balance !"
            });
        }

        await Account.updateOne({ userId: to }, { $inc: { balance: amount } }).session(session);

        // the record is part of the same mongo transaction, so it exists only if the money moved
        const [transaction] = await Transaction.create([{
            from: req.userId,
            to,
            amount
        }], { session });

        // Commit the transaction
        await session.commitTransaction();
        res.json({
            message: "Transfer successful",
            transactionId: transaction._id
        });
    } catch (err) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("transfer failed", err);
        res.status(500).json({
            message: "Transfer failed, please try again"
        });
    } finally {
        await session.endSession();
    }
}));

const historyQuery = zod.object({
    type: zod.enum(["all", "sent", "received"]).default("all"),
    cursor: zod.string().regex(/^[a-f\d]{24}$/i, "Invalid cursor").optional(),
    limit: zod.coerce.number().int().min(1).max(50).default(20)
})

// newest first. pass the returned nextCursor to get the next page
router.get("/transactions", authMiddleware, asyncHandler(async (req, res) => {
    const parsed = historyQuery.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({
            message: parsed.error.issues[0].message
        });
    }
    const { type, cursor, limit } = parsed.data;

    const me = new mongoose.Types.ObjectId(String(req.userId));
    const filter = type === "sent" ? { from: me }
        : type === "received" ? { to: me }
            : { $or: [{ from: me }, { to: me }] };
    if (cursor) {
        filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    // one extra row tells us if there is another page
    const rows = await Transaction.find(filter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .populate("from", "firstName lastName")
        .populate("to", "firstName lastName")
        .lean();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    res.json({
        transactions: page.map(t => {
            const sent = String(t.from?._id) === String(me);
            const other = sent ? t.to : t.from;
            return {
                _id: t._id,
                direction: sent ? "sent" : "received",
                amount: t.amount,
                status: t.status,
                createdAt: t.createdAt,
                counterparty: other
                    ? { _id: other._id, firstName: other.firstName, lastName: other.lastName }
                    : null
            };
        }),
        nextCursor: hasMore ? page[page.length - 1]._id : null
    });
}));

module.exports = router;