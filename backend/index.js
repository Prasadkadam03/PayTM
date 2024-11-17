const express = require("express");
const app = express();
const mainRouter = require("./routes/index.js")
const userRouter = require("./routes/user.js")
const {User} = require("./db")

app.use("/api/v1",mainRouter);
app.use("/api/v1/user",userRouter);

const Port = 3000;
app.use(express.json());


app.listen(Port);