const express = require("express");
const bodyParser = require("body-parser");
const Producer = require("./producer");
const LogSagaOrchestrator = require("./saga/LogSagaOrchestrator");

const app = express();
const producer = new Producer();
const saga = new LogSagaOrchestrator(producer, 3, 500); // 3 retries, 500ms base delay

app.use(bodyParser.json("application/json"));

app.get("/", (req, res) => {
  res.send("Welcome to the Logger Microservice");
});

app.post("/sendLog", async (req, res) => {
  const { logType, message } = req.body;

  if (!logType || !message) {
    return res.status(400).json({ error: "logType and message are required." });
  }

  try {
    const result = await saga.execute(logType, message);
    res.status(200).json(result);
  } catch (err) {
    const isValidationError = err.message.startsWith("Invalid") || err.message.startsWith("Message");
    const status = isValidationError ? 400 : 503;
    res.status(status).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Server started on port 3000...");
});