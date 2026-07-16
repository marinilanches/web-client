const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

/* ==========================================================
   FIREBASE ADMIN
========================================================== */

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

/* ==========================================================
   EXPRESS
========================================================== */

const app = express();
app.use(cors());
app.use(express.json());

/* ==========================================================
   ESTADO DO WHATSAPP
========================================================== */

const whatsappState = {
  status: "DESCONECTADO",
  numero: null,
  qrCode: null,
  mensagensHoje: 0,
  ultimaAtualizacao: null,
};

/* ==========================================================
   CLIENTE WHATSAPP
========================================================== */

let client = null;
let pedidosListenerIniciado = false;

function atualizarEstado(dados = {}) {
  Object.assign(whatsappState, dados, {
    ultimaAtualizacao: new Date().toISOString(),
  });
}

function normalizarTelefone(telefone) {
  if (!telefone) return null;

  let numero = String(telefone).replace(/\D/g, "");

  // remove zeros à esquerda
  numero = numero.replace(/^0+/, "");

  // se vier com 9 dígitos (celular sem DDD), assume DDD 19
  // exemplo: 991521322 -> 19991521322
  if (numero.length === 9) {
    numero = `19${numero}`;
  }

  // se vier com 8 dígitos (fixo sem DDD), assume DDD 19
  // exemplo: 32451234 -> 1932451234
  if (numero.length === 8) {
    numero = `19${numero}`;
  }

  // se tiver DDD + número, mas sem país, adiciona 55
  // 10 = fixo com DDD | 11 = celular com DDD
  if (numero.length === 10 || numero.length === 11) {
    numero = `55${numero}`;
  }

  // se ainda não começar com 55, mas já estiver no tamanho BR sem o país,
  // também garante o prefixo
  if (
    !numero.startsWith("55") &&
    (numero.length === 10 || numero.length === 11)
  ) {
    numero = `55${numero}`;
  }

  // número brasileiro final esperado:
  // 12 dígitos = 55 + DDD + fixo
  // 13 dígitos = 55 + DDD + celular
  if (numero.length < 12 || numero.length > 13) {
    return null;
  }

  return numero;
}

const URL_PUBLICA = "https://marinilanches.vercel.app";

function gerarLinkPedido(pedidoId) {
  return `${URL_PUBLICA}/status.html?id=${pedidoId}`;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function montarMensagemStatus(pedido) {
  const cliente = pedido.cliente || "Cliente";
  const numeroPedido = pedido.numeroPedido || pedido.id;
  const total = formatarMoeda(pedido.valorTotal);
  const linkPedido = gerarLinkPedido(pedido.id);

  switch (pedido.status) {
    case "RECEBIDO":
      return `Olá *${cliente}*!

🛍️ Recebemos seu pedido *#${numeroPedido}*

Total: *${total}*

Em breve seu pedido será confirmado.

Veja os detalhes do seu pedido no link:

${linkPedido}

Agradecemos pela sua escolha.

Qualquer dúvida, estamos à disposição.

Atenciosamente,

*Equipe Lanches Marini*`;

    case "PREPARANDO":
      return `Olá *${cliente}*!

👨‍🍳 Seu pedido *#${numeroPedido}* já está sendo preparado.

Você pode acompanhar o andamento em tempo real:

${linkPedido}

Obrigado pela preferência!`;

    case "PRONTO":
      return `Olá *${cliente}*!

✅ Seu pedido *#${numeroPedido}* está pronto.

Confira os detalhes:

${linkPedido}

Obrigado pela preferência!`;

    case "ENTREGUE":
      return `Olá *${cliente}*!

🚚 Seu pedido *#${numeroPedido}* foi finalizado.

Muito obrigado pela preferência!

Esperamos atendê-lo novamente em breve.`;

    case "CANCELADO":
      return `Olá *${cliente}*!

❌ Infelizmente seu pedido *#${numeroPedido}* foi cancelado.

Caso tenha dúvidas, entre em contato conosco.`;

    default:
      return null;
  }
}

async function enviarMensagemPedido(pedidoId, pedido) {
  const telefoneNormalizado =
    pedido.telefoneWhatsapp || normalizarTelefone(pedido.telefone);

  if (!telefoneNormalizado) {
    console.log(
      `[BOT] Pedido ${pedidoId} sem telefone válido. Notificação ignorada.`,
    );
    return;
  }

  const mensagem = montarMensagemStatus({
  ...pedido,
  id: pedidoId,
});

  if (!mensagem) {
    console.log(`[BOT] Status ${pedido.status} sem mensagem configurada.`);
    return;
  }

  await client.sendMessage(`${telefoneNormalizado}@c.us`, mensagem);

  await db.collection("pedidos").doc(pedidoId).update({
    ultimoStatusNotificado: pedido.status,
    notificacaoWhatsappEm: FieldValue.serverTimestamp(),
  });

  whatsappState.mensagensHoje += 1;

  console.log(
    `[BOT] Mensagem enviada para ${telefoneNormalizado} - pedido ${pedidoId} - status ${pedido.status}`,
  );
}

function iniciarListenerPedidos() {
  if (pedidosListenerIniciado) return;

  pedidosListenerIniciado = true;

  db.collection("pedidos").onSnapshot(
    async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== "added" && change.type !== "modified") continue;

        const pedidoId = change.doc.id;
        const pedido = change.doc.data();

        const statusAtual = pedido.status || null;
        const ultimoStatusNotificado = pedido.ultimoStatusNotificado || null;

        if (!statusAtual) continue;
        if (statusAtual === ultimoStatusNotificado) continue;

        // só envia se o WhatsApp estiver conectado
        if (whatsappState.status !== "CONECTADO") {
          console.log(
            `[BOT] WhatsApp não conectado. Pedido ${pedidoId} aguardando.`,
          );
          continue;
        }

        try {
          await enviarMensagemPedido(pedidoId, pedido);
        } catch (erro) {
          console.error(
            `[BOT] Erro ao enviar mensagem do pedido ${pedidoId}:`,
            erro,
          );
        }
      }
    },
    (erro) => {
      console.error("[BOT] Erro ao ouvir pedidos:", erro);
    },
  );

  console.log("[BOT] Listener de pedidos iniciado.");
}

async function criarClienteWhatsapp() {
  if (client) {
    try {
      await client.destroy();
    } catch (e) {
      console.warn("[BOT] Erro ao destruir cliente anterior:", e.message);
    }
  }

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: "mesa-facil",
    }),
    puppeteer: {
      headless: false,
      executablePath:
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", async (qr) => {
    try {
      const qrBase64 = await QRCode.toDataURL(qr);

      atualizarEstado({
        status: "AGUARDANDO_QR",
        qrCode: qrBase64,
        numero: null,
      });

      console.log("[BOT] QR Code gerado.");
    } catch (erro) {
      console.error("[BOT] Erro ao gerar QR em base64:", erro);
    }
  });

  client.on("authenticated", () => {
    atualizarEstado({
      status: "AUTENTICADO",
    });

    console.log("[BOT] WhatsApp autenticado.");
  });

  client.on("ready", async () => {
    let numero = null;

    try {
      const info = client.info;
      numero = info?.wid?.user || null;
    } catch (e) {
      console.warn("[BOT] Não foi possível obter número da sessão.");
    }

    atualizarEstado({
      status: "CONECTADO",
      numero,
      qrCode: null,
    });

    console.log("[BOT] WhatsApp pronto!");
    iniciarListenerPedidos();
  });

  client.on("auth_failure", (msg) => {
    atualizarEstado({
      status: "FALHA_AUTENTICACAO",
      qrCode: null,
    });

    console.error("[BOT] Falha na autenticação:", msg);
  });

  client.on("disconnected", async (reason) => {
    atualizarEstado({
      status: "DESCONECTADO",
      numero: null,
      qrCode: null,
    });

    console.warn("[BOT] WhatsApp desconectado:", reason);

    try {
      await client.destroy();
    } catch (e) {
      console.warn(
        "[BOT] Erro ao destruir cliente após desconexão:",
        e.message,
      );
    }
  });

  client.initialize();
}

/* ==========================================================
   ROTAS API
========================================================== */

app.get("/api/whatsapp/status", (req, res) => {
  res.json({
    success: true,
    ...whatsappState,
  });
});

app.post("/api/whatsapp/reconnect", async (req, res) => {
  try {
    atualizarEstado({
      status: "RECONECTANDO",
      qrCode: null,
      numero: null,
    });

    criarClienteWhatsapp();

    res.json({
      success: true,
      message: "Reconexão iniciada.",
    });
  } catch (erro) {
    console.error("[BOT] Erro ao reconectar:", erro);

    res.status(500).json({
      success: false,
      message: "Erro ao reconectar WhatsApp.",
    });
  }
});

/* ==========================================================
   START
========================================================== */

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`🚀 API do WhatsApp rodando em http://localhost:${PORT}`);
});

criarClienteWhatsapp();
