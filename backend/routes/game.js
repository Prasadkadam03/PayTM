const express = require("express");
const cors = require("cors");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const zod = require("zod");
const { GamePlay } = require("../db");
const { gamePlayLimiter, gameDashboardLimiter } = require("../rateLimit");
const { asyncHandler } = require("../utils/asyncHandler");

const uuid = zod.string().uuid("Invalid identifier");
const cleanName = zod.string()
    .transform((value) => value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim())
    .pipe(zod.string().min(1, "Name is required").max(24, "Name can be at most 24 characters"));

const playBody = zod.object({
    playId: uuid,
    visitorId: uuid,
    name: cleanName
}).strict();

const duplicatePlay = (error) => error?.code === 11000 && (
    error?.keyPattern?.playId || error?.keyValue?.playId
);

function createGameRouter({
    GamePlayModel = GamePlay,
    writeLimiter = gamePlayLimiter,
    readLimiter = gameDashboardLimiter
} = {}) {
    const router = express.Router();

    // These endpoints carry no cookies or PayTM credentials and are intentionally callable
    // from the separately hosted game. The main PayTM CORS policy remains restricted.
    router.use(cors({ origin: "*", credentials: false }));
    router.use(express.json({ limit: "2kb" }));
    router.use(mongoSanitize());
    router.use(hpp());

    router.post("/plays", writeLimiter, asyncHandler(async (req, res) => {
        const parsed = playBody.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0].message });
        }

        try {
            await GamePlayModel.create(parsed.data);
            return res.status(201).json({ counted: true });
        } catch (error) {
            if (duplicatePlay(error)) {
                return res.json({ counted: false });
            }
            throw error;
        }
    }));

    router.get("/dashboard", readLimiter, asyncHandler(async (_req, res) => {
        const [players, plays] = await Promise.all([
            GamePlayModel.aggregate([
                { $sort: { createdAt: 1, _id: 1 } },
                {
                    $group: {
                        _id: "$visitorId",
                        name: { $last: "$name" },
                        playCount: { $sum: 1 },
                        firstPlayedAt: { $min: "$createdAt" },
                        lastPlayedAt: { $max: "$createdAt" }
                    }
                },
                { $sort: { playCount: -1, lastPlayedAt: -1, name: 1 } },
                {
                    $project: {
                        _id: 0,
                        name: 1,
                        playCount: 1,
                        firstPlayedAt: 1,
                        lastPlayedAt: 1
                    }
                }
            ]),
            GamePlayModel.estimatedDocumentCount()
        ]);

        res.set("Cache-Control", "no-store");
        res.json({
            totals: { players: players.length, plays },
            players
        });
    }));

    return router;
}

const router = createGameRouter();

module.exports = router;
module.exports.createGameRouter = createGameRouter;
module.exports.playBody = playBody;
