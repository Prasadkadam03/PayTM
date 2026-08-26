// backend/scripts/migrate-to-paise.js
// one-off: converts every account balance from rupees to paise (x100)
// usage: node scripts/migrate-to-paise.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const MIGRATION = "balance-to-paise";

const run = async () => {
    await mongoose.connect(process.env.DBURL);
    const db = mongoose.connection.db;

    // a marker document makes the script safe to run twice
    const done = await db.collection("migrations").findOne({ name: MIGRATION });
    if (done) {
        console.log("already migrated on", done.ranAt);
        return;
    }

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const result = await db.collection("accounts").updateMany(
                {},
                [{ $set: { balance: { $round: [{ $multiply: ["$balance", 100] }, 0] } } }],
                { session }
            );
            await db.collection("migrations").insertOne({ name: MIGRATION, ranAt: new Date() }, { session });
            console.log(`converted ${result.modifiedCount} accounts to paise`);
        });
    } finally {
        await session.endSession();
    }
};

run()
    .catch((err) => {
        console.error("migration failed", err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
