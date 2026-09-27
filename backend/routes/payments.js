// backend/routes/payments.js
const express = require("express");
const zod = require("zod");
const { Transaction, User, isEmailVerified } = require("../db");
const { authMiddleware } = require("../middleware");
const { asyncHandler } = require("../utils/asyncHandler");
const { audit } = require("../utils/audit");
const { accountLimiter } = require("../rateLimit");
const {
    MIN_TOPUP, MAX_TOPUP, PaymentError, isEnabled,
    createTopupOrder, checkoutSignatureOk, webhookSignatureOk, creditTopup
} = require("../services/payments");

const router = express.Router();

const sendError = (res, err) => {
    if (err instanceof PaymentError) {
        return res.status(err.status).json({ message: err.message });
    }
    throw err;
};

// the frontend asks before showing the add money button
router.get("/config", authMiddleware, (req, res) => {
    res.json({ enabled: isEnabled(), keyId: isEnabled() ? process.env.RAZORPAY_KEY_ID : null, min: MIN_TOPUP, max: MAX_TOPUP });
});

router.post("/order", authMiddleware, accountLimiter, asyncHandler(async (req, res) => {
    const parsed = zod.object({
        amount: zod.number().int("Invalid amount").min(MIN_TOPUP, "Add at least ₹1").max(MAX_TOPUP, "You can add at most ₹10,000 at a time")
    }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const user = await User.findById(req.userId);
    if (!user || !isEmailVerified(user)) {
        return res.status(403).json({ message: "Verify your email before adding money" });
    }

    try {
        const order = await createTopupOrder(req.userId, parsed.data.amount);
        await audit(req, "topup_started", { meta: { orderId: order.orderId, amount: order.amount } });
        res.status(201).json(order);
    } catch (err) {
        sendError(res, err);
    }
}));

// called by the browser right after razorpay checkout succeeds
router.post("/verify", authMiddleware, asyncHandler(async (req, res) => {
    const parsed = zod.object({
        razorpay_order_id: zod.string().max(64),
        razorpay_payment_id: zod.string().max(64),
        razorpay_signature: zod.string().max(128)
    }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payment details" });
    }
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;

    // the order must be this user's own top-up
    const mine = await Transaction.exists({ razorpayOrderId: orderId, type: "topup", to: req.userId });
    if (!mine) {
        return res.status(404).json({ message: "Unknown order" });
    }
    if (!isEnabled() || !checkoutSignatureOk(orderId, paymentId, signature)) {
        await audit(req, "topup_bad_signature", { meta: { orderId } });
        return res.status(400).json({ message: "Payment could not be verified" });
    }

    try {
        const { transaction, credited } = await creditTopup({ orderId, paymentId });
        if (credited) {
            await audit(req, "topup", { meta: { orderId, amount: transaction.amount } });
        }
        res.json({ message: "Money added", transactionId: transaction._id, amount: transaction.amount });
    } catch (err) {
        sendError(res, err);
    }
}));

// razorpay -> us. mounted in index.js with express.raw, because the signature covers the raw bytes
const webhook = asyncHandler(async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    if (!webhookSignatureOk(raw, req.get("X-Razorpay-Signature"))) {
        return res.status(400).json({ message: "Bad signature" });
    }

    let event;
    try {
        event = JSON.parse(raw.toString("utf8"));
    } catch {
        return res.status(400).json({ message: "Bad payload" });
    }

    // anything else is acknowledged and ignored so razorpay stops retrying it
    const payment = event?.payload?.payment?.entity;
    if (!["payment.captured", "order.paid"].includes(event?.event) || !payment?.order_id) {
        return res.json({ ok: true });
    }
    if (payment.currency !== "INR") {
        return res.status(400).json({ message: "Unexpected currency" });
    }

    try {
        const { transaction, credited } = await creditTopup({ orderId: payment.order_id, paymentId: payment.id, amount: payment.amount });
        if (credited) {
            await audit(req, "topup", { userId: transaction.to, meta: { orderId: payment.order_id, amount: transaction.amount, via: "webhook" } });
        }
        res.json({ ok: true });
    } catch (err) {
        // unknown order: not ours (or a replay from another environment), don't make razorpay retry forever
        if (err instanceof PaymentError && err.status === 404) {
            return res.json({ ok: true });
        }
        sendError(res, err);
    }
});

module.exports = { router, webhook };
