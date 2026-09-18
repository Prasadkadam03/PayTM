// backend/index.js
const express = require('express');
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
const rootRouter = require("./routes/index");
const dotEnv = require("dotenv");
const { default: mongoose } = require('mongoose');
const { loadConfig } = require("./config");

const app = express();
dotEnv.config();

app.disable("x-powered-by");
// behind render's proxy the real client ip is in X-Forwarded-For (used by rate limits and the audit log)
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}
app.use(helmet());
// only the frontend origins listed in CORS_ORIGIN (comma separated) may call the api from a browser
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // requests without an Origin header (curl, server to server) are not subject to CORS
        callback(null, !origin || allowedOrigins.includes(origin));
    },
    // the refresh token travels as a cookie
    credentials: true
}));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
// strips keys starting with $ or containing . so user input can't become a mongo operator
app.use(mongoSanitize());
// ?type=sent&type=received -> last value only, so query params are always strings
app.use(hpp());

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
