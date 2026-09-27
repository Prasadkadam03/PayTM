// backend/services/payments.js
// add money with razorpay (test mode). the wallet is only credited after razorpay's
// signature checks out, and each order can be credited once
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { Account, Transaction } = require("../db");

const MIN_TOPUP = 100;        // ₹1
const MAX_TOPUP = 10000_00;   // ₹10,000

const config = () => ({
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    apiUrl: (process.env.RAZORPAY_API_URL || "https://api.razorpay.com/v1").replace(/\/$/, "")
});

const isEnabled = () => Boolean(config().keyId && config().keySecret);

class PaymentError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

const hmac = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");

// constant time, and false (not a throw) for wrong lengths
const sameHex = (a, b) => {
    const x = Buffer.from(String(a || ""), "utf8");
    const y = Buffer.from(String(b || ""), "utf8");
    return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// razorpay order + a pending top-up row that remembers who it is for and how much
const createTopupOrder = async (userId, amount) => {
    if (!isEnabled()) {
        throw new PaymentError("Adding money is not set up on this server", 503);
    }
    const { keyId, keySecret, apiUrl } = config();
    const response = await fetch(`${apiUrl}/orders`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64")
        },
        body: JSON.stringify({
            amount,
            currency: "INR",
            receipt: `topup_${userId}_${Date.now()}`.slice(0, 40),
            notes: { userId: String(userId) }
        })
    });
    if (!response.ok) {
        console.error("razorpay order failed", response.status, await response.text());
        throw new PaymentError("Could not start the payment, please try again", 502);
    }
    const order = await response.json();
    if (order.amount !== amount || order.currency !== "INR") {
        throw new PaymentError("Payment provider returned an unexpected order", 502);
    }

    await Transaction.create({
        type: "topup",
        to: userId,
        amount,
        status: "pending",
        razorpayOrderId: order.id
    });
    return { orderId: order.id, amount, currency: "INR", keyId };
};

// signature razorpay checkout hands to the browser after a successful payment
const checkoutSignatureOk = (orderId, paymentId, signature) =>
    sameHex(hmac(config().keySecret, `${orderId}|${paymentId}`), signature);

// webhooks are signed over the exact raw body bytes
const webhookSignatureOk = (rawBody, signature) =>
    Boolean(config().webhookSecret) && sameHex(hmac(config().webhookSecret, rawBody), signature);

/**
 * credits the wallet for a paid order. safe to call many times and in parallel (checkout
 * callback + webhook): only the call that flips the row from pending to success adds money.
 * returns { transaction, credited }
 */
const creditTopup = async ({ orderId, paymentId, amount }) => {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            const pending = await Transaction.findOne({ razorpayOrderId: orderId, type: "topup" }).session(session);
            if (!pending) {
                throw new PaymentError("Unknown order", 404);
            }
            if (amount !== undefined && amount !== pending.amount) {
                throw new PaymentError("Paid amount does not match the order", 400);
            }
            if (pending.status === "success") {
                result = { transaction: pending, credited: false };
                return;
            }

            const flipped = await Transaction.findOneAndUpdate(
                { _id: pending._id, status: "pending" },
                { status: "success", razorpayPaymentId: paymentId },
                { new: true, session }
            );
            if (!flipped) {
                result = { transaction: pending, credited: false };
                return;
            }
            await Account.updateOne({ userId: pending.to }, { $inc: { balance: pending.amount } }).session(session);
            result = { transaction: flipped, credited: true };
        });
        return result;
    } finally {
        await session.endSession();
    }
};

module.exports = {
    MIN_TOPUP,
    MAX_TOPUP,
    PaymentError,
    isEnabled,
    createTopupOrder,
    checkoutSignatureOk,
    webhookSignatureOk,
    creditTopup
};
