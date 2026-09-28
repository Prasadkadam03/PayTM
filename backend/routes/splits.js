// backend/routes/splits.js
// split a bill: the creator paid, each friend gets a money request for their share
const express = require("express");
const zod = require("zod");
const mongoose = require("mongoose");
const { Split, MoneyRequest, User } = require("../db");
const { authMiddleware } = require("../middleware");
const { asyncHandler } = require("../utils/asyncHandler");
const { audit } = require("../utils/audit");
const { requestLimiter } = require("../rateLimit");
const { REQUEST_TTL_MS, MAX_OPEN_REQUESTS, expireOld } = require("../services/requestRules");
const { notifyRequestCreated } = require("../socket/notify");

const router = express.Router();

const MAX_PEOPLE = 10;

const objectId = zod.string().regex(/^[a-f\d]{24}$/i, "Invalid user");
const paise = zod.number().int("Amounts must be in whole paise").positive("Amounts must be more than zero");

const createBody = zod.object({
    // paise
    total: paise.max(Number.MAX_SAFE_INTEGER),
    note: zod.string()
        .transform(s => s.replace(/[\u0000-\u001f\u007f]/g, "").trim())
        .pipe(zod.string().max(100, "Note can be at most 100 characters"))
        .optional(),
    // equal: total / (people + you). custom: each person's share, you pay the rest
    mode: zod.enum(["equal", "custom"]).default("equal"),
    participants: zod.array(zod.object({
        userId: objectId,
        share: paise.optional()
    })).min(1, "Pick at least one person").max(MAX_PEOPLE, `At most ${MAX_PEOPLE} people per split`)
});

// who owes what. equal splits give any leftover paise to the creator, who already paid the bill
const computeShares = ({ total, mode, participants }) => {
    if (mode === "equal") {
        const each = Math.floor(total / (participants.length + 1));
        if (each < 1) {
            throw new Error("The total is too small to split between that many people");
        }
        return {
            shares: participants.map(p => ({ userId: p.userId, share: each })),
            creatorShare: total - each * participants.length
        };
    }
    if (participants.some(p => !p.share)) {
        throw new Error("Enter a share for every person");
    }
    const billed = participants.reduce((sum, p) => sum + p.share, 0);
    if (billed > total) {
        throw new Error("Shares add up to more than the total");
    }
    return {
        shares: participants.map(p => ({ userId: p.userId, share: p.share })),
        creatorShare: total - billed
    };
};

router.post("/", authMiddleware, requestLimiter, asyncHandler(async (req, res) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { total, note, mode, participants } = parsed.data;

    const ids = participants.map(p => p.userId);
    if (new Set(ids).size !== ids.length) {
        return res.status(400).json({ message: "Each person can only be added once" });
    }
    if (ids.includes(String(req.userId))) {
        return res.status(400).json({ message: "Don't add yourself, your share is worked out for you" });
    }
    if (await User.countDocuments({ _id: { $in: ids } }) !== ids.length) {
        return res.status(400).json({ message: "Invalid user" });
    }

    let plan;
    try {
        plan = computeShares({ total, mode, participants });
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }

    await expireOld({ from: req.userId });
    const open = await MoneyRequest.countDocuments({ from: req.userId, status: "pending" });
    if (open + ids.length > MAX_OPEN_REQUESTS) {
        return res.status(429).json({ message: `You can have at most ${MAX_OPEN_REQUESTS} open requests` });
    }

    // the split and all of its requests are created together or not at all
    const session = await mongoose.startSession();
    let split;
    // kept outside so the live updates go out only after the commit
    let requests = [];
    try {
        await session.withTransaction(async () => {
            const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);
            const splitId = new mongoose.Types.ObjectId();
            requests = await MoneyRequest.create(plan.shares.map(s => ({
                from: req.userId,
                to: s.userId,
                amount: s.share,
                note: note ? `Split: ${note}`.slice(0, 100) : "Split bill",
                expiresAt,
                splitId
            })), { session, ordered: true });

            [split] = await Split.create([{
                _id: splitId,
                creator: req.userId,
                total,
                creatorShare: plan.creatorShare,
                note: note || undefined,
                participants: plan.shares.map((s, i) => ({ ...s, requestId: requests[i]._id }))
            }], { session });
        });
    } finally {
        await session.endSession();
    }

    await audit(req, "split_created", { meta: { splitId: split._id, total, people: ids.length } });
    requests.forEach(notifyRequestCreated);
    res.status(201).json({ message: "Split created", splitId: split._id, creatorShare: plan.creatorShare });
}));

// a split with each person's request status
const present = (split, requestsById) => ({
    _id: split._id,
    total: split.total,
    creatorShare: split.creatorShare,
    note: split.note || "",
    createdAt: split.createdAt,
    creator: split.creator && { _id: split.creator._id, firstName: split.creator.firstName, lastName: split.creator.lastName },
    participants: split.participants.map(p => ({
        userId: p.userId?._id,
        firstName: p.userId?.firstName,
        lastName: p.userId?.lastName,
        share: p.share,
        status: requestsById.get(String(p.requestId))?.status || "unknown"
    }))
});

const load = async (filter) => {
    const splits = await Split.find(filter)
        .sort({ _id: -1 })
        .limit(30)
        .populate("creator", "firstName lastName")
        .populate("participants.userId", "firstName lastName")
        .lean();
    const requestIds = splits.flatMap(s => s.participants.map(p => p.requestId));
    await expireOld({ _id: { $in: requestIds } });
    const requests = await MoneyRequest.find({ _id: { $in: requestIds } }).select("status").lean();
    const byId = new Map(requests.map(r => [String(r._id), r]));
    return splits.map(s => present(s, byId));
};

// splits I created
router.get("/", authMiddleware, asyncHandler(async (req, res) => {
    res.json({ splits: await load({ creator: req.userId }) });
}));

// creator or anyone in it can look at it
router.get("/:id", authMiddleware, asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(404).json({ message: "Split not found" });
    }
    const [split] = await load({
        _id: req.params.id,
        $or: [{ creator: req.userId }, { "participants.userId": req.userId }]
    });
    if (!split) {
        return res.status(404).json({ message: "Split not found" });
    }
    res.json({ split });
}));

module.exports = router;
