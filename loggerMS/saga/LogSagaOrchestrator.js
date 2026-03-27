class LogSagaOrchestrator {
  constructor(producer, maxRetries = 3, baseDelayMs = 500) {
    this.producer = producer;
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
  }

  // Exponential backoff delay: 500ms, 1000ms, 2000ms...
  async _delay(attempt) {
    const ms = this.baseDelayMs * Math.pow(2, attempt);
    return new Promise((res) => setTimeout(res, ms));
  }

  async execute(logType, message) {
    const sagaId = `saga-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    console.log(`[Saga ${sagaId}] Starting for logType=${logType}`);

    // --- Step 1: Validate ---
    try {
      this._validate(logType, message);
    } catch (err) {
      console.error(`[Saga ${sagaId}] Validation failed: ${err.message}`);
      await this._compensate(sagaId, logType, message, "VALIDATION_FAILED");
      throw err; // surface to HTTP layer → 400
    }

    // --- Step 2: Publish with retry ---
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.producer.publishMessage(logType, message);
        console.log(`[Saga ${sagaId}] Published successfully on attempt ${attempt + 1}`);
        await this._emitSagaEvent(sagaId, "COMPLETED", logType);
        return { sagaId, status: "COMPLETED" };
      } catch (err) {
        lastError = err;
        console.warn(
          `[Saga ${sagaId}] Attempt ${attempt + 1} failed: ${err.message}`
        );
        if (attempt < this.maxRetries) {
          await this._delay(attempt);
        }
      }
    }

    // --- All retries exhausted → compensate ---
    console.error(`[Saga ${sagaId}] All retries failed.`);
    await this._compensate(sagaId, logType, message, "PUBLISH_FAILED");
    throw lastError;
  }

  _validate(logType, message) {
    const allowed = ["Info", "Warning", "Error"];
    if (!logType || !allowed.includes(logType)) {
      throw new Error(`Invalid logType: "${logType}". Must be Info, Warning, or Error.`);
    }
    if (!message || typeof message !== "string" || message.trim() === "") {
      throw new Error("Message must be a non-empty string.");
    }
  }

  async _compensate(sagaId, logType, message, reason) {
    // Compensation: write to a dead-letter or audit queue/log
    // You can also publish to a "sagaFailures" exchange here
    console.error(`[Saga ${sagaId}] COMPENSATING — reason: ${reason}`, {
      logType,
      message,
      timestamp: new Date(),
    });
    // Optional: push to a DLQ via producer
    // await this.producer.publishMessage("DeadLetter", JSON.stringify({ sagaId, logType, message, reason }));
  }

  async _emitSagaEvent(sagaId, status, logType) {
    console.log(`[Saga ${sagaId}] Event: ${status} for logType=${logType}`);
    // Optional: publish to a "sagaEvents" exchange for observability
  }
}

module.exports = LogSagaOrchestrator;