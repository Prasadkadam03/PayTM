// backend/routes/account.js
const express = require('express');
const { authMiddleware } = require('../middleware');
const { Account, Transaction } = require('../db');
const { transferMoney, assertCanSend, TransferError } = require("../services/transfer");
const { default: mongoose } = require('mongoose');
const zod = require("zod");
const { asyncHandler } = require("../utils/asyncHandler");
const { audit } = require("../utils/audit");
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
    amount: zod.number().int("Invalid amount").positive("Invalid amount").max(Number.MAX_SAFE_INTEGER),
    // control characters are stripped, the rest is escaped by react when shown
    note: zod.string().transform(s => s.replace(/[\u0000-\u001f\u007f]/g, "").trim()).pipe(zod.string().max(100, "Note can be at most 100 characters")).optional()
})

router.post("/transfer", authMiddleware, transferLimiter, asyncHandler(async (req, res) => {
    const parsed = transferBody.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: parsed.error.issues[0].message
        });
    }
    const { amount, to, note } = parsed.data;

    try {
        await assertCanSend(req.userId);
        const { transaction } = await transferMoney({ fromUserId: req.userId, toUserId: to, amount, note });

        await audit(req, "transfer", { meta: { to, amount, transactionId: transaction._id } });

        res.json({
            message: "Transfer successful",
            transactionId: transaction._id
        });
    } catch (err) {
        if (err instanceof TransferError) {
            return res.status(err.status).json({
                message: err.message
            });
        }
        console.error("transfer failed", err);
        res.status(500).json({
            message: "Transfer failed, please try again"
        });
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
                note: t.note || "",
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