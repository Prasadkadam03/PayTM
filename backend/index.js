const express = require("express");
const app = express();
const cors = require("cors")
app.use(express.json());
const mainRouter = require("./routes/index.js")
const userRouter = require("./routes/user.js")

app.use("/api/v1",mainRouter);
app.use("/api/v1/user",userRouter);
app.use(cors());





app.listen(3000);