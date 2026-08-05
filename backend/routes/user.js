// backend/routes/user.js
const express = require('express');
const router = express.Router();
const zod = require("zod");
const { User, Account } = require("../db");
const jwt = require("jsonwebtoken");
const { authMiddleware } = require("../middleware");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { asyncHandler } = require("../utils/asyncHandler");

const signupBody = zod.object({
    username: zod.string().trim().toLowerCase().email("Enter a valid email"),
    firstName: zod.string().trim().min(1, "First name is required").max(50),
    lastName: zod.string().trim().min(1, "Last name is required").max(50),
    password: zod.string()
        .min(8, "Password must be at least 8 characters")
        .max(72, "Password is too long")
        .regex(/[a-zA-Z]/, "Password must contain a letter")
        .regex(/[0-9]/, "Password must contain a number")
})

router.post("/signup", asyncHandler(async (req, res) => {
    const parsed = signupBody.safeParse(req.body)
    if (!parsed.success) {
        return res.status(400).json({
            message: parsed.error.issues[0].message
        })
    }
    const { username, firstName, lastName, password } = parsed.data;

    const existingUser = await User.findOne({
        username
    })

    if (existingUser) {
        return res.status(409).json({
            message: "An account with this email already exists"
        })
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // user and account are created together so we never end up with a user without a wallet
    const session = await mongoose.startSession();
    let userId;
    try {
        await session.withTransaction(async () => {
            const [user] = await User.create([{
                username,
                password: hashedPassword,
                firstName,
                lastName,
            }], { session })
            userId = user._id;

            await Account.create([{
                userId,
                balance: 1000 // every user gets 1000 as signup.. we have lot of money 🥱
            }], { session })
        });
    } finally {
        await session.endSession();
    }

    const token = jwt.sign({
        userId
    }, process.env.JWT_SECRET);

    res.json({
        message: "User created successfully",
        token: token
    })
}))


const signinBody = zod.object({
    username: zod.string().email(),
    password: zod.string()
})

router.post("/signin", asyncHandler(async (req, res) => {
    const { success } = signinBody.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            message: "Enter a valid email and password"
        })
    }

    const user = await User.findOne({
        username: req.body.username,
    });

    const match = user && await bcrypt.compare(req.body.password, user.password);
    if (!match) {
        return res.status(401).json({
            message: "Invalid email or password"
        });
    }

    const token = jwt.sign({
        userId: user._id
    }, process.env.JWT_SECRET);

    res.json({
        token: token
    })
}))

const updateBody = zod.object({
    password: zod.string().optional(),
    firstName: zod.string().optional(),
    lastName: zod.string().optional(),
})

router.put("/", authMiddleware, asyncHandler(async (req, res) => {
    const { success, data } = updateBody.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            message: "Error while updating information"
        })
    }

    if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
    }

    await User.updateOne({ _id: req.userId }, data)

    res.json({
        message: "Updated successfully"
    })
}))

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/bulk", authMiddleware, asyncHandler(async (req, res) => {
    const filter = escapeRegex(String(req.query.filter || "").trim().slice(0, 50));
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const users = await User.find({
        _id: { $ne: req.userId },
        $or: [{
            firstName: {
                "$regex": filter,
                "$options": "i"
            }
        }, {
            lastName: {
                "$regex": filter,
                "$options": "i"
            }
        }]
    })
        .select("firstName lastName")
        .limit(limit)

    res.json({
        users: users.map(user => ({
            firstName: user.firstName,
            lastName: user.lastName,
            _id: user._id
        }))
    })
}))

router.get("/getUser", authMiddleware, asyncHandler(async (req, res) => {
    const user = await User.findOne({
        _id: req.userId
    });

    if (!user) {
        return res.status(404).json({
            message: "User not found"
        });
    }

    res.json({ firstName: user.firstName });
}));

router.get("/cron", async (req, res) => {

    res.json({
        msg : "successfull"
    });
});

module.exports = router;