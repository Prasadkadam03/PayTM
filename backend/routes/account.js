// backend/routes/account.js
const express = require('express');
const { authMiddleware } = require('../middleware');
const { Account, Transaction } = require('../db');
const { transferMoney, findReplay, assertCanSend, TransferError } = require("../services/transfer");
const { default: mongoose } = require('mongoose');
const zod = require("zod");
const { asyncHandler } = require("../utils/asyncHandler");
const { audit } = require("../utils/audit");
const { writeReceipt } = require("../services/receipt");
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
    note: zod.string().transform(s => s.replace(/[\u0000-\u001f\u007f]/g, "").trim()).pipe(zod.string().max(100, "Note can be at most 100 characters")).optional(),
    pin: zod.string({ required_error: "Enter your transaction PIN" }).max(6)
})

router.post("/transfer", authMiddleware, transferLimiter, asyncHandler(async (req, res) => {
    const parsed = transferBody.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: parsed.error.issues[0].message
        });
    }
    const { amount, to, note, pin } = parsed.data;

    const idempotencyKey = req.get("Idempotency-Key");
    if (idempotencyKey !== undefined && !/^[A-Za-z0-9-]{8,64}$/.test(idempotencyKey)) {
        return res.status(400).json({
            message: "Invalid Idempotency-Key"
        });
    }

    try {
        // a retry of a payment that already went through gets the same answer, nothing moves twice
        const replay = await findReplay(req.userId, idempotencyKey, { toUserId: to, amount });
        if (replay) {
            return res.json({
                message: "Transfer successful",
                transactionId: replay.transaction._id,
                replayed: true
            });
        }

        await assertCanSend(req, req.userId, pin);
        const { transaction, replay: raced } = await transferMoney({ fromUserId: req.userId, toUserId: to, amount, note, idempotencyKey });

        if (!raced) {
            await audit(req, "transfer", { meta: { to, amount, transactionId: transaction._id } });
        }

        res.json({
            message: "Transfer successful",
            transactionId: transaction._id,
            ...(raced ? { replayed: true } : {})
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
                type: t.type || "transfer",
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

// a transaction the signed in user took part in, or null. anyone else gets a 404,
// which doesn't even confirm the transaction exists
const findMyTransaction = async (req, id) => {
    if (!/^[a-f\d]{24}$/i.test(id)) return null;
    return Transaction.findOne({ _id: id, $or: [{ from: req.userId }, { to: req.userId }] })
        .populate("from", "firstName lastName")
        .populate("to", "firstName lastName")
        .lean();
};

const person = (user) => (user ? { _id: user._id, firstName: user.firstName, lastName: user.lastName } : null);

router.get("/transactions/:id", authMiddleware, asyncHandler(async (req, res) => {
    const t = await findMyTransaction(req, req.params.id);
    if (!t) {
        return res.status(404).json({ message: "Transaction not found" });
    }
    res.json({
        transaction: {
            _id: t._id,
            type: t.type || "transfer",
            direction: String(t.from?._id) === String(req.userId) ? "sent" : "received",
            amount: t.amount,
            note: t.note || "",
            status: t.status,
            createdAt: t.createdAt,
            from: person(t.from),
            to: person(t.to)
        }
    });
}));

router.get("/transactions/:id/receipt", authMiddleware, asyncHandler(async (req, res) => {
    const t = await findMyTransaction(req, req.params.id);
    if (!t) {
        return res.status(404).json({ message: "Transaction not found" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="paytm-receipt-${t._id}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    writeReceipt(t, res);
}));

module.exports = router;