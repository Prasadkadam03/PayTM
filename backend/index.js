// backend/index.js
const express = require('express');
const cors = require("cors");
const rootRouter = require("./routes/index");
const dotEnv = require("dotenv");
const { default: mongoose } = require('mongoose');

const app = express();
dotEnv.config();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.DBURL);

app.use("/api/v1", rootRouter);

app.listen(process.env.PORT);