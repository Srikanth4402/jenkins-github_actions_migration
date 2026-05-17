const express = require("express");
const entriesRouter = require("./routes/entries");

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", version: process.env.APP_VERSION || "1.0.0" });
});

app.use("/entries", entriesRouter);

module.exports = app;
