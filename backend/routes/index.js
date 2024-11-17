const express = require("express");
const app = express();
const userRouter = require("./user");

const router = express.router();
router.use("/user", userRouter);


module.export = router;