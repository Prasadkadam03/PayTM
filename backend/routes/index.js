// backend/user/index.js
const express = require('express');
const userRouter = require("./user");
const accountRouter = require("./account");
const requestRouter = require("./requests");

const router = express.Router();

router.use("/user", userRouter);
router.use("/account", accountRouter);
router.use("/requests", requestRouter);

module.exports = router;