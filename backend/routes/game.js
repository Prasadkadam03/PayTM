const express = require("express");
const cors = require("cors");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const zod = require("zod");
const { GamePlayer, GamePlay } = require("../db");
const { gamePlayerLimiter, gamePlayLimiter, gameDashboardLimiter } = require("../rateLimit");
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

const playerBody = zod.object({
    visitorId: uuid,
    name: cleanName
}).strict();

const duplicatePlay = (error) => error?.code === 11000 && (
    error?.keyPattern?.playId || error?.keyValue?.playId
);

function createGameRouter({
    GamePlayerModel = GamePlayer,
    GamePlayModel = GamePlay,
    playerWriteLimiter = gamePlayerLimiter,
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

    const upsertPlayer = (player) => GamePlayerModel.updateOne(
        { visitorId: player.visitorId },
        { $set: { name: player.name } },
        { upsert: true, runValidators: true }
    );

    router.post("/players", playerWriteLimiter, asyncHandler(async (req, res) => {
        const parsed = playerBody.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0].message });
        }

        const result = await upsertPlayer(parsed.data);
        return res.status(result.upsertedCount ? 201 : 200).json({ registered: true });
    }));

    router.post("/plays", writeLimiter, asyncHandler(async (req, res) => {
        const parsed = playBody.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0].message });
        }

        let counted = true;
        try {
            await GamePlayModel.create(parsed.data);
        } catch (error) {
            if (duplicatePlay(error)) {
                counted = false;
            } else {
                throw error;
            }
        }

        // Also register from a completed play. This covers old clients and a profile request
        // that loses a race with the first completed battle.
        await upsertPlayer(parsed.data);
        return res.status(counted ? 201 : 200).json({ counted });
    }));

    router.get("/dashboard", readLimiter, asyncHandler(async (_req, res) => {
        const [registeredPlayers, playedPlayers, plays] = await Promise.all([
            GamePlayerModel.find(
                {},
                { _id: 0, visitorId: 1, name: 1, createdAt: 1, updatedAt: 1 }
            ).lean(),
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
                        visitorId: "$_id",
                        name: 1,
                        playCount: 1,
                        firstPlayedAt: 1,
                        lastPlayedAt: 1
                    }
                }
            ]),
            GamePlayModel.estimatedDocumentCount()
        ]);

        const playerMap = new Map(registeredPlayers.map((player) => [player.visitorId, {
            name: player.name,
            playCount: 0,
            firstPlayedAt: null,
            lastPlayedAt: null,
            lastActivityAt: player.updatedAt || player.createdAt
        }]));

        for (const player of playedPlayers) {
            const registered = playerMap.get(player.visitorId);
            playerMap.set(player.visitorId, {
                name: registered?.name || player.name,
                playCount: player.playCount,
                firstPlayedAt: player.firstPlayedAt,
                lastPlayedAt: player.lastPlayedAt,
                lastActivityAt: player.lastPlayedAt
            });
        }

        const players = [...playerMap.values()]
            .sort((a, b) => b.playCount - a.playCount
                || new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
                || a.name.localeCompare(b.name))
            .map(({ lastActivityAt: _lastActivityAt, ...player }) => player);

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
module.exports.playerBody = playerBody;
