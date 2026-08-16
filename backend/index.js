// backend/index.js
const express = require('express');
const cors = require("cors");
const helmet = require("helmet");
const rootRouter = require("./routes/index");
const dotEnv = require("dotenv");
const { default: mongoose } = require('mongoose');
const { loadConfig } = require("./config");

const app = express();
dotEnv.config();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));

app.use("/api/v1", rootRouter);

app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Invalid JSON body" });
    }
    if (err.type === "entity.too.large") {
        return res.status(413).json({ message: "Request body too large" });
    }
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
});

const start = async () => {
    const config = loadConfig();
    await mongoose.connect(config.DBURL);
    app.listen(config.PORT, () => {
        console.log(`server running on port ${config.PORT}`);
    });
};

start().catch((err) => {
    console.error("failed to start server", err);
    process.exit(1);
});
