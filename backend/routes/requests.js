// backend/routes/requests.js
// request money: ask someone to pay you, they pay (with their pin) or decline
const express = require("express");
const zod = require("zod");
const mongoose = require("mongoose");
const { MoneyRequest, User } = require("../db");
const { authMiddleware } = require("../middleware");
const { asyncHandler } = require("../utils/asyncHandler");
const { audit } = require("../utils/audit");
const { transferMoney, assertCanSend, TransferError } = require("../services/transfer");
const { transferLimiter, requestLimiter } = require("../rateLimit");
const { REQUEST_TTL_MS, MAX_OPEN_REQUESTS, expireOld } = require("../services/requestRules");

const router = express.Router();

const objectId = zod.string().regex(/^[a-f\d]{24}$/i, "Invalid user");
const cleanNote = zod.string()
    .transform(s => s.replace(/[\u0000-\u001f\u007f]/g, "").trim())
    .pipe(zod.string().max(100, "Note can be at most 100 characters"))
    .optional();

const createBody = zod.object({
    to: objectId,
    // paise
    amount: zod.number().int("Invalid amount").positive("Invalid amount").max(Number.MAX_SAFE_INTEGER),
    note: cleanNote
});

router.post("/", authMiddleware, requestLimiter, asyncHandler(async (req, res) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { to, amount, note } = parsed.data;

    if (to === String(req.userId)) {
        return res.status(400).json({ message: "You cannot request money from yourself" });
    }
    if (!await User.exists({ _id: to })) {
        return res.status(400).json({ message: "Invalid user" });
    }

    await expireOld({ from: req.userId });
    const open = await MoneyRequest.countDocuments({ from: req.userId, status: "pending" });
    if (open >= MAX_OPEN_REQUESTS) {
        return res.status(429).json({ message: `You can have at most ${MAX_OPEN_REQUESTS} open requests` });
    }

    const request = await MoneyRequest.create({
        from: req.userId,
        to,
        amount,
        note: note || undefined,
        expiresAt: new Date(Date.now() + REQUEST_TTL_MS)
    });
    await audit(req, "request_created", { meta: { requestId: request._id, to, amount } });
    res.status(201).json({ message: "Request sent", requestId: request._id });
}));

const listQuery = zod.object({
    box: zod.enum(["incoming", "outgoing"]).default("incoming"),
    status: zod.enum(["pending", "all"]).default("all")
});

const person = (u) => (u ? { _id: u._id, firstName: u.firstName, lastName: u.lastName } : null);

router.get("/", authMiddleware, asyncHandler(async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { box, status } = parsed.data;
    const mine = box === "incoming" ? { to: req.userId } : { from: req.userId };

    await expireOld(mine);
    const rows = await MoneyRequest.find({ ...mine, ...(status === "pending" ? { status: "pending" } : {}) })
        .sort({ _id: -1 })
        .limit(50)
        .populate("from", "firstName lastName")
        .populate("to", "firstName lastName")
        .lean();

    res.json({
        requests: rows.map(r => ({
            _id: r._id,
            amount: r.amount,
            note: r.note || "",
            status: r.status,
            createdAt: r.createdAt,
            expiresAt: r.expiresAt,
            transactionId: r.transactionId || null,
            splitId: r.splitId || null,
            from: person(r.from),
            to: person(r.to)
        }))
    });
}));

// for the badge in the app bar
router.get("/count", authMiddleware, asyncHandler(async (req, res) => {
    await expireOld({ to: req.userId });
    res.json({ pending: await MoneyRequest.countDocuments({ to: req.userId, status: "pending" }) });
}));

const idParam = (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(404).json({ message: "Request not found" });
        return null;
    }
    return req.params.id;
};

router.post("/:id/pay", authMiddleware, transferLimiter, asyncHandler(async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;

    const request = await MoneyRequest.findOne({ _id: id, to: req.userId });
    if (!request) {
        return res.status(404).json({ message: "Request not found" });
    }
    if (request.status !== "pending" || request.expiresAt <= new Date()) {
        return res.status(409).json({ message: `This request is ${request.status === "pending" ? "expired" : request.status}` });
    }

    try {
        await assertCanSend(req, req.userId, req.body?.pin);
        const { transaction } = await transferMoney({
            fromUserId: req.userId,
            toUserId: request.from,
            amount: request.amount,
            note: request.note,
            type: "request",
            // marked paid in the same mongo transaction as the money, so it can't be paid twice
            inTransaction: async (session, transaction) => {
                const result = await MoneyRequest.updateOne(
                    { _id: request._id, status: "pending", expiresAt: { $gt: new Date() } },
                    { status: "paid", transactionId: transaction._id }
                ).session(session);
                if (result.modifiedCount !== 1) {
                    throw new TransferError("This request was already handled", 409);
                }
            }
        });

        await audit(req, "request_paid", { meta: { requestId: request._id, transactionId: transaction._id } });
        res.json({ message: "Request paid", transactionId: transaction._id });
    } catch (err) {
        if (err instanceof TransferError) {
            return res.status(err.status).json({ message: err.message });
        }
        throw err;
    }
}));

// payer says no / requester takes it back. both only from pending
const close = (who, status, event) => asyncHandler(async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;

    const updated = await MoneyRequest.findOneAndUpdate(
        { _id: id, [who]: req.userId, status: "pending", expiresAt: { $gt: new Date() } },
        { status },
        { new: true }
    );
    if (!updated) {
        const exists = await MoneyRequest.exists({ _id: id, [who]: req.userId });
        return res.status(exists ? 409 : 404).json({ message: exists ? "This request was already handled" : "Request not found" });
    }
    await audit(req, event, { meta: { requestId: updated._id } });
    res.json({ message: `Request ${status}` });
});

router.post("/:id/decline", authMiddleware, close("to", "declined", "request_declined"));
router.post("/:id/cancel", authMiddleware, close("from", "cancelled", "request_cancelled"));

module.exports = router;
