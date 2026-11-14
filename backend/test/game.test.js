const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { rateLimit } = require("express-rate-limit");
const { createGameRouter } = require("../routes/game");

const ids = {
    visitorA: "10000000-0000-4000-8000-000000000001",
    visitorB: "10000000-0000-4000-8000-000000000002",
    playA: "20000000-0000-4000-8000-000000000001",
    playB: "20000000-0000-4000-8000-000000000002",
    playC: "20000000-0000-4000-8000-000000000003"
};

class FakeGamePlay {
    static rows = [];

    static reset() {
        this.rows = [];
    }

    static async create(data) {
        if (this.rows.some((row) => row.playId === data.playId)) {
            const error = new Error("duplicate");
            error.code = 11000;
            error.keyPattern = { playId: 1 };
            error.keyValue = { playId: data.playId };
            throw error;
        }
        const row = { ...data, createdAt: new Date(Date.UTC(2026, 0, this.rows.length + 1)) };
        this.rows.push(row);
        return row;
    }

    static async aggregate() {
        const grouped = new Map();
        for (const row of this.rows) {
            const current = grouped.get(row.visitorId) || {
                name: row.name,
                playCount: 0,
                firstPlayedAt: row.createdAt,
                lastPlayedAt: row.createdAt
            };
            current.name = row.name;
            current.playCount++;
            if (row.createdAt < current.firstPlayedAt) current.firstPlayedAt = row.createdAt;
            if (row.createdAt > current.lastPlayedAt) current.lastPlayedAt = row.createdAt;
            grouped.set(row.visitorId, current);
        }
        return [...grouped.values()].sort((a, b) =>
            b.playCount - a.playCount || b.lastPlayedAt - a.lastPlayedAt || a.name.localeCompare(b.name)
        );
    }

    static async estimatedDocumentCount() {
        return this.rows.length;
    }
}

const pass = (_req, _res, next) => next();
const makeApp = ({ writeLimiter = pass, readLimiter = pass } = {}) => {
    const app = express();
    app.use("/api/v1/game", createGameRouter({
        GamePlayModel: FakeGamePlay,
        writeLimiter,
        readLimiter
    }));
    app.use((error, _req, res, _next) => res.status(500).json({ message: error.message }));
    return app;
};

test.beforeEach(() => FakeGamePlay.reset());

test("validates and sanitizes completed plays", async () => {
    const app = makeApp();
    const invalid = await request(app).post("/api/v1/game/plays").send({ name: "" });
    assert.equal(invalid.status, 400);

    const created = await request(app).post("/api/v1/game/plays").send({
        playId: ids.playA,
        visitorId: ids.visitorA,
        name: "  Commander\u0000   Nova  "
    });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body, { counted: true });
    assert.equal(FakeGamePlay.rows[0].name, "Commander Nova");
});

test("duplicate play ids are idempotent", async () => {
    const app = makeApp();
    const body = { playId: ids.playA, visitorId: ids.visitorA, name: "Nova" };
    assert.equal((await request(app).post("/api/v1/game/plays").send(body)).status, 201);
    const duplicate = await request(app).post("/api/v1/game/plays").send(body);
    assert.equal(duplicate.status, 200);
    assert.deepEqual(duplicate.body, { counted: false });
    assert.equal(FakeGamePlay.rows.length, 1);
});

test("dashboard aggregates players without exposing visitor ids", async () => {
    const app = makeApp();
    for (const body of [
        { playId: ids.playA, visitorId: ids.visitorA, name: "Nova" },
        { playId: ids.playB, visitorId: ids.visitorA, name: "Nova Prime" },
        { playId: ids.playC, visitorId: ids.visitorB, name: "Rin" }
    ]) await request(app).post("/api/v1/game/plays").send(body);

    const response = await request(app)
        .get("/api/v1/game/dashboard")
        .set("Origin", "https://game.example");
    assert.equal(response.status, 200);
    assert.equal(response.headers["access-control-allow-origin"], "*");
    assert.deepEqual(response.body.totals, { players: 2, plays: 3 });
    assert.equal(response.body.players[0].name, "Nova Prime");
    assert.equal(response.body.players[0].playCount, 2);
    assert.equal(JSON.stringify(response.body).includes(ids.visitorA), false);
});

test("write rate limiting returns 429", async () => {
    const tinyLimiter = rateLimit({
        windowMs: 60_000,
        limit: 1,
        standardHeaders: "draft-8",
        legacyHeaders: false
    });
    const app = makeApp({ writeLimiter: tinyLimiter });
    const first = await request(app).post("/api/v1/game/plays").send({
        playId: ids.playA,
        visitorId: ids.visitorA,
        name: "Nova"
    });
    const second = await request(app).post("/api/v1/game/plays").send({
        playId: ids.playB,
        visitorId: ids.visitorA,
        name: "Nova"
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 429);
});
