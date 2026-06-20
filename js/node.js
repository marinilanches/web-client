const { Client } = require("whatsapp-web.js");
const client = new Client();

client.on("ready", () => {
  console.log("WhatsApp pronto");
});

client.initialize();