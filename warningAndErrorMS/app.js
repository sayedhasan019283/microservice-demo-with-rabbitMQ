//step 1 : Connect to the rabbitmq server
//step 2 : Create a new channel
//step 3 : Create the exchange
//step 4 : Create the queue
//step 5 : Bind the queue to the exchange
//step 6 : Consume messages from the queue

const amqp = require("amqplib");

async function connectWithRetry(retries = 10, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting to connect... (${i + 1}/${retries})`);
      const connection = await amqp.connect({
        protocol: "amqp",
        hostname: "rabbitmq",
        port: 5672,
        username: "guest",
        password: "guest",
        vhost: "/",
        heartbeat: 60,
      });
      console.log("Connected to RabbitMQ!");
      return connection;
    } catch (err) {
      console.log(
        `Connection failed: ${err.message}. Retrying in ${delayMs / 1000}s...`,
      );
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
  throw new Error("Could not connect to RabbitMQ after multiple attempts");
}

async function consumeMessages() {
  // Note: In a production system, you might want to handle connection loss and re-establish the connection/channel as needed. This example focuses on the initial connection and consumption logic.
  const connection = await connectWithRetry();
  const channel = await connection.createChannel();

  await channel.assertExchange("logExchange", "direct");
  const q = await channel.assertQueue("WarningAndErrorsQueue");
  await channel.bindQueue(q.queue, "logExchange", "Warning");
  await channel.bindQueue(q.queue, "logExchange", "Error");

  console.log("Waiting for messages...");
  channel.consume(q.queue, (msg) => {
    const data = JSON.parse(msg.content.toString()); // also fixed: was msg.content (no toString)
    if (data.logType === "Warning") {
      console.log("Received:",   "yes! yoooo! This is a warning log");
    } else if (data.logType === "Error") {
      // In a real system, you might want to trigger alerts, write to a separate error log, or take other actions for errors. For this example, we'll just log it to the console.
      console.log("Received:",  "yes! yoooo! This is an error log");
    }
    channel.ack(msg);
  });
}

consumeMessages().catch((err) => console.error("Consumer error:", err));
