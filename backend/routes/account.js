// backend/routes/account.js
const express = require('express');
const { authMiddleware } = require('../middleware');
const { Account } = require('../db');
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

        // Fetch the accounts within the transaction
        const account = await Account.findOne({ userId: req.userId }).session(session);

        if (!account || account.balance < amount) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Insufficient balance !"
            });
        }

        const toAccount = await Account.findOne({ userId: to }).session(session);

        if (!toAccount) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Invalid account"
            });
        }

        // Perform the transfer
        await Account.updateOne({ userId: req.userId }, { $inc: { balance: -amount } }).session(session);
        await Account.updateOne({ userId: to }, { $inc: { balance: amount } }).session(session);

        // Commit the transaction
        await session.commitTransaction();
        res.json({
            message: "Transfer successful"
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

module.exports = router;