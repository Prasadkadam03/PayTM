// backend/config.js
const zod = require("zod");

const envSchema = zod.object({
    NODE_ENV: zod.enum(["development", "production", "test"]).default("development"),
    PORT: zod.coerce.number().int().positive().default(3000),
    DBURL: zod.string().min(1, "DBURL is required"),
    JWT_SECRET: zod.string().min(1, "JWT_SECRET is required"),
});

// validates process.env once at startup so a bad config fails fast instead of at the first request
const loadConfig = () => {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        const problems = parsed.error.issues.map(issue => `  ${issue.path.join(".")}: ${issue.message}`);
        throw new Error("Invalid environment variables:\n" + problems.join("\n"));
    }

    const config = parsed.data;
    if (config.JWT_SECRET.length < 32) {
        if (config.NODE_ENV === "production") {
            throw new Error("JWT_SECRET must be at least 32 characters in production");
        }
        console.warn("warning: JWT_SECRET is shorter than 32 characters, use a longer one in production");
    }
    return config;
};

module.exports = { loadConfig };
