const amqp = require("amqplib");
const config = require("./config");

//step 1 : Connect to the rabbitmq server
//step 2 : Create a new channel on that connection
//step 3 : Create the exchange
//step 4 : Publish the message to the exchange with a routing key

class Producer {
  channel;

  async createChannel() {
    const connection = await amqp.connect({
      protocol: "amqp",
      hostname: "rabbitmq",
      port: 5672,
      username: "guest",
      password: "guest",
      vhost: "/",
      heartbeat: 60,
    });
    this.channel = await connection.createChannel();
  }

  async publishMessage(routingKey, message) {
    if (!this.channel) {
      await this.createChannel();
    }

    const exchangeName = "logExchange";
    await this.channel.assertExchange(exchangeName, "direct");

    const logDetails = {
      logType: routingKey,
      message: message,
      dateTime: new Date(),
    };
    await this.channel.publish(
      exchangeName,
      routingKey,
      Buffer.from(JSON.stringify(logDetails)),
    );
    // Log the message details to the console for debugging purposes. This will help us verify that the message is being sent correctly and contains the expected information.
    console.log(
      `The new ${routingKey} log is sent to exchange ${exchangeName}`,
    );
  }
}

module.exports = Producer;
