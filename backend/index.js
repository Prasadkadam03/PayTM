const express = require("express");
const app = express();
const mainRouter = require("./routes/index.js")
const cors = require("cors")
const jwt = require("jsonwebtoken");

app.use("/api/v1",mainRouter);
app.use(cors());

const Port = 3000;
app.use(express.json());




app.listen(Port);