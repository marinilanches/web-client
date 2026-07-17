const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");
const { solicitarEntregador } = require("./bee/bee.orders");

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
let clienteAnterior = null;

const enviadosRecentemente = new Set();
const enviando = new Set();
let pedidosListenerIniciado = false;
let unsubscribePedidos = null;

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

let filaMensagens = Promise.resolve();

let whatsappPronto = false;

let idSessaoWhatsapp = 0;

let inicializandoCliente = false;

let reconectando = false;

function ehErroFrame(e) {
  const mensagem = String(e?.message || e);

  return (
    mensagem.includes("detached Frame") ||
    mensagem.includes("Target closed") ||
    mensagem.includes("Execution context")
  );
}

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enviarMensagemPedido(pedidoId, pedido) {
  const clienteAtual = client;
  const sessaoEnvio = idSessaoWhatsapp;

  if (sessaoEnvio !== idSessaoWhatsapp) {
    console.log("[BOT] Sessão antiga cancelada antes da consulta.");
    return;
  }

  if (!clienteAtual || !whatsappPronto || reconectando) {
    console.log("[BOT] Cliente WhatsApp ainda não está pronto.");
    return;
  }

  const doc = await db.collection("pedidos").doc(pedidoId).get();

  const dadosAtuais = doc.data();

  if (dadosAtuais?.ultimoStatusNotificado === pedido.status) {
    console.log(`[BOT] Pedido ${pedidoId} já foi notificado.`);

    return;
  }

  const telefoneNormalizado =
    pedido.telefoneWhatsapp || normalizarTelefone(pedido.telefone);

  if (!telefoneNormalizado) {
    console.log(`[BOT] Pedido ${pedidoId} sem telefone válido.`);

    return;
  }

  const mensagem = montarMensagemStatus({
    ...pedido,
    id: pedidoId,
  });

  console.log("[BOT] STATUS ATUAL:", pedido.status);
  console.log("[BOT] MENSAGEM GERADA:");
  console.log(mensagem);

  if (!mensagem) {
    console.log(`[BOT] Status ${pedido.status} sem mensagem.`);

    return;
  }

  const chatId = `${telefoneNormalizado}@c.us`;

  // Não usar isRegisteredUser()
  // Essa função causa detached Frame em algumas versões do whatsapp-web.js.

  if (!clienteAtual || sessaoEnvio !== idSessaoWhatsapp) {
    console.log("[BOT] Cliente inválido antes do envio.");
    return;
  }

  if (!whatsappPronto) {
    console.log("[BOT] WhatsApp não está pronto.");
    return;
  }

  console.log("[BOT] Cliente pronto, enviando...");

  console.log("[BOT] pupPage existe:", !!clienteAtual.pupPage);

  console.log("[BOT] pupPage fechada:", clienteAtual.pupPage?.isClosed());

  console.log(
    "[BOT] Browser conectado:",
    clienteAtual.pupBrowser?.isConnected(),
  );

  await aguardar(1000);

  let resultado = null;

  try {
    const estado = await clienteAtual.getState();

    console.log("[BOT] Estado antes envio:", estado);

    if (estado !== "CONNECTED") {
      console.log("[BOT] WhatsApp não conectado.");
      return;
    }

    await aguardar(5000);

    const estadoAntesEnvio = await clienteAtual.getState();

    console.log("[BOT] Estado final antes envio:", estadoAntesEnvio);

    if (estadoAntesEnvio !== "CONNECTED") {
      console.log("[BOT] Cancelando envio, WhatsApp reiniciando.");
      return;
    }

    console.log("[BOT] Enviando para:", chatId);
    console.log("[BOT] Tamanho mensagem:", mensagem.length);
    console.log("[BOT] Status:", pedido.status);

    console.log("[BOT] CHAT ID:", chatId);
    console.log("[BOT] STATUS:", pedido.status);
    console.log("[BOT] PRIMEIROS 50 CARACTERES:", mensagem.substring(0, 50));

    await clienteAtual.sendMessage(chatId, mensagem, {
      sendSeen: false,
    });

    console.log("[BOT] WhatsApp aceitou o envio.");
  } catch (e) {
    console.error("[BOT] Erro envio:", e);
  }

  await db.collection("pedidos").doc(pedidoId).update({
    ultimoStatusNotificado: pedido.status,
    notificacaoWhatsappEm: FieldValue.serverTimestamp(),
  });

  whatsappState.mensagensHoje++;

  console.log(
    `[BOT] Mensagem enviada para ${telefoneNormalizado} - pedido ${pedidoId} - status ${pedido.status}`,
  );

  enviadosRecentemente.add(`${pedidoId}_${pedido.status}`);

  setTimeout(() => {
    enviadosRecentemente.delete(`${pedidoId}_${pedido.status}`);
  }, 60000);
}

function iniciarListenerPedidos() {
  if (pedidosListenerIniciado) return;

  pedidosListenerIniciado = true;

  unsubscribePedidos = db.collection("pedidos").onSnapshot(
    async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== "added" && change.type !== "modified") continue;

        const pedidoId = change.doc.id;
        const pedido = change.doc.data();

        const chaveEnvio = `${pedidoId}_${pedido.status}`;

        const statusAtual = pedido.status || null;
        const ultimoStatusNotificado = pedido.ultimoStatusNotificado || null;

        if (!statusAtual) continue;
        if (statusAtual === ultimoStatusNotificado) continue;

        // só envia se o WhatsApp estiver conectado
        if (!whatsappPronto || reconectando) {
          console.log(`[BOT] WhatsApp offline. Pedido ${pedidoId} aguardando.`);

          continue;
        }

        if (enviando.has(chaveEnvio) || enviadosRecentemente.has(chaveEnvio)) {
          console.log(`[BOT] Pedido ${chaveEnvio} já processado.`);

          continue;
        }

        enviando.add(chaveEnvio);

        filaMensagens = filaMensagens
          .catch(() => {})
          .then(async () => {
            try {
              await enviarMensagemPedido(pedidoId, pedido);
            } catch (erro) {
              console.error(`[BOT] Erro pedido ${pedidoId}:`, erro.message);
            } finally {
              enviando.delete(chaveEnvio);
            }
          });
      }
    },
    (erro) => {
      console.error("[BOT] Erro ao ouvir pedidos:", erro);
    },
  );

  console.log("[BOT] Listener de pedidos iniciado.");

  enviandoMensagemAgora = false;
}

function limparFilaWhatsapp() {
  filaMensagens = Promise.resolve();

  enviando.clear();
}

async function reconectarWhatsapp() {
  if (reconectando) {
    return;
  }

  reconectando = true;

  if (unsubscribePedidos) {
    unsubscribePedidos();
    unsubscribePedidos = null;
  }

  pedidosListenerIniciado = false;

  try {
    await aguardar(3000);

    limparFilaWhatsapp();

    if (client) {
      try {
        await client.destroy();
      } catch (e) {
        console.log("[BOT] Erro destruindo cliente:", e.message);
      }

      client = null;
    }

    await criarClienteWhatsapp();
  } catch (e) {
    console.error("[BOT] Erro na reconexão:", e.message);
  } finally {
    reconectando = false;
  }
}

async function criarClienteWhatsapp() {
  if (inicializandoCliente) {
    console.log("[BOT] Cliente já está sendo inicializado.");
    return;
  }

  inicializandoCliente = true;

  if (client) {
    console.log("[BOT] Destruindo cliente antigo antes de criar.");

    try {
      await client.destroy();
    } catch (e) {
      console.log("[BOT] Erro destruindo cliente antigo:", e.message);
    }

    client = null;
  }

  idSessaoWhatsapp++;

  clienteAnterior = client;

  client = null;

  if (clienteAnterior) {
    try {
      await clienteAnterior.destroy();
    } catch (e) {
      console.warn("[BOT] Erro ao destruir cliente anterior:", e.message);
    }

    clienteAnterior = null;
  }

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: "mesa-facil",
    }),
    puppeteer: {
      headless: true,

      executablePath:
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",

      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
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

  let autenticado = false;

  client.on("authenticated", () => {
    if (autenticado) {
      console.log("[BOT] Autenticação duplicada ignorada.");
      return;
    }

    autenticado = true;

    atualizarEstado({
      status: "AUTENTICADO",
    });

    console.log("[BOT] WhatsApp autenticado.");
  });

  let prontoDisparado = false;

  const clienteAtual = client;

  clienteAtual.on("disconnected", (reason) => {
    console.log("[BOT] Evento disconnected:", reason);
  });

  clienteAtual.on("change_state", (state) => {
    console.log("[BOT] Estado:", state);
  });

  clienteAtual.on("loading_screen", (percent, message) => {
    console.log(`[BOT] Carregando WhatsApp ${percent}% - ${message}`);
  });

  clienteAtual.on("change_state", async (state) => {
    console.log("[BOT] Estado WhatsApp:", state);

    if (state !== "CONNECTED") {
      whatsappPronto = false;
    }
  });

  clienteAtual.on("ready", async () => {
    if (prontoDisparado) {
      console.log("[BOT] Evento ready duplicado ignorado.");
      return;
    }

    prontoDisparado = true;

    let numero = null;

    try {
      const info = clienteAtual.info;
      numero = info?.wid?.user || null;
    } catch (e) {
      console.warn("[BOT] Não foi possível obter número da sessão.");
    }

    await aguardar(5000);

    const estado = await clienteAtual.getState();

    console.log("[BOT] Estado após estabilizar:", estado);

    if (estado !== "CONNECTED") {
      console.log("[BOT] WhatsApp ainda instável.");
      return;
    }

    whatsappPronto = true;

    atualizarEstado({
      status: "CONECTADO",
      numero,
      qrCode: null,
    });

    console.log("[BOT] WhatsApp pronto!");

    iniciarListenerPedidos();
  });

  clienteAtual.on("browser_closed", () => {
    console.log("[BOT] Browser do WhatsApp foi fechado.");
  });

  clienteAtual.on("change_state", (state) => {
    console.log("[BOT] Estado WhatsApp:", state);
  });

  client.on("auth_failure", (msg) => {
    atualizarEstado({
      status: "FALHA_AUTENTICACAO",
      qrCode: null,
    });

    console.error("[BOT] Falha na autenticação:", msg);
  });

  const clienteDesconectado = client;

  clienteDesconectado.on("disconnected", async (reason) => {
    whatsappPronto = false;

    atualizarEstado({
      status: "DESCONECTADO",
      numero: null,
      qrCode: null,
    });

    console.warn("[BOT] WhatsApp desconectado:", reason);

    if (clienteDesconectado) {
      try {
        try {
          if (clienteDesconectado && clienteDesconectado.pupBrowser) {
            await clienteDesconectado.destroy();
          }
        } catch (e) {
          console.log("[BOT] Erro destruindo sessão:", e.message);
        }
      } catch (e) {
        console.warn("[BOT] Erro ao destruir cliente:", e.message);
      }
    }

    if (client === clienteDesconectado) {
      client = null;
    }

    if (!reconectando) {
      setTimeout(() => {
        console.log("[BOT] Tentando reconectar...");
        reconectarWhatsapp();
      }, 5000);
    }
  });

  try {
    await client.initialize();
  } catch (erro) {
    console.error("[BOT] Erro ao inicializar:", erro.message);
  } finally {
    inicializandoCliente = false;
  }
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

    await reconectarWhatsapp();

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

app.post("/api/bee/solicitar-entrega", async (req, res) => {
  try {
    const resposta = await solicitarEntregador(req.body.pedido);

    res.json({
      success: true,

      resposta,
    });
  } catch (error) {
    console.error("[BEE]", error);

    res.status(500).json({
      success: false,

      message: "Erro ao solicitar entregador",
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