const { Client } = require("whatsapp-web.js");
const client = new Client();

client.on("ready", () => {
  console.log("🤖 WhatsApp pronto!");
});

client.on("message", msg => {
  console.log(msg.body);
});

client.initialize();

function sendMessage(number, text) {
  client.sendMessage(number + "@c.us", text);
}

db.collection("pedidos")
  .onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {

      if (change.type === "modified") {
        const p = change.doc.data();

        if (p.status === "PRONTO") {
          sendMessage(
            p.telefone,
            `🍔 Seu pedido está PRONTO!`
          );
        }
      }
    });
  });