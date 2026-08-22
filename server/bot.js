const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const { initializeApp, cert } = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

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

let filaMensagens = Promise.resolve();

let whatsappPronto = false;

let idSessaoWhatsapp = 0;

let inicializandoCliente = false;

let reconectando = false;

/* ==========================================================
   FUNÇÕES AUXILIARES
========================================================== */

function atualizarEstado(dados = {}) {
  Object.assign(whatsappState, dados, {
    ultimaAtualizacao: new Date().toISOString(),
  });
}

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ehErroFrame(e) {
  const mensagem = String(e?.message || e);

  return (
    mensagem.includes("detached Frame") ||
    mensagem.includes("Target closed") ||
    mensagem.includes("Execution context")
  );
}

/* ==========================================================
   TELEFONE
========================================================== */

function normalizarTelefone(telefone) {
  if (!telefone) return null;

  let numero = String(telefone).replace(/\D/g, "");

  // Remove zeros à esquerda
  numero = numero.replace(/^0+/, "");

  // Se vier com 9 dígitos, assume DDD 19
  // Exemplo:
  // 991521322 -> 19991521322
  if (numero.length === 9) {
    numero = `19${numero}`;
  }

  // Se vier com 8 dígitos, assume DDD 19
  // Exemplo:
  // 32451234 -> 1932451234
  if (numero.length === 8) {
    numero = `19${numero}`;
  }

  // DDD + número, mas sem país
  if (numero.length === 10 || numero.length === 11) {
    numero = `55${numero}`;
  }

  // Garantia adicional do prefixo 55
  if (
    !numero.startsWith("55") &&
    (numero.length === 10 || numero.length === 11)
  ) {
    numero = `55${numero}`;
  }

  // Número brasileiro esperado:
  // 12 dígitos = 55 + DDD + fixo
  // 13 dígitos = 55 + DDD + celular
  if (numero.length < 12 || numero.length > 13) {
    return null;
  }

  return numero;
}

/* ==========================================================
   PEDIDOS
========================================================== */

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

/* ==========================================================
   ENVIO DE MENSAGENS
========================================================== */

async function enviarMensagemPedido(pedidoId, pedido) {
  const clienteAtual = client;
  const sessaoEnvio = idSessaoWhatsapp;

  // Verifica se a sessão ainda é a mesma
  if (sessaoEnvio !== idSessaoWhatsapp) {
    console.log(
      "[BOT] Sessão antiga cancelada antes da consulta."
    );

    return;
  }

  // Verifica disponibilidade
  if (!clienteAtual || !whatsappPronto || reconectando) {
    console.log(
      "[BOT] Cliente WhatsApp ainda não está pronto."
    );

    return;
  }

  /* --------------------------------------------------------
     CONFERE O PEDIDO NOVAMENTE NO FIRESTORE
  -------------------------------------------------------- */

  const doc = await db
    .collection("pedidos")
    .doc(pedidoId)
    .get();

  if (!doc.exists) {
    console.log(
      `[BOT] Pedido ${pedidoId} não existe mais.`
    );

    return;
  }

  const dadosAtuais = doc.data();

  /*
   * Se o status atual do Firestore mudou enquanto
   * o pedido estava aguardando na fila, usamos o
   * status atual.
   */
  if (
    dadosAtuais?.status &&
    dadosAtuais.status !== pedido.status
  ) {
    console.log(
      `[BOT] Status do pedido ${pedidoId} mudou enquanto aguardava na fila.`
    );

    return;
  }

  /*
   * Não envia novamente se já foi notificado.
   */
  if (
    dadosAtuais?.ultimoStatusNotificado === pedido.status
  ) {
    console.log(
      `[BOT] Pedido ${pedidoId} já foi notificado.`
    );

    return;
  }

  /* --------------------------------------------------------
     TELEFONE
  -------------------------------------------------------- */

  const telefoneNormalizado =
    pedido.telefoneWhatsapp ||
    normalizarTelefone(pedido.telefone);

  if (!telefoneNormalizado) {
    console.log(
      `[BOT] Pedido ${pedidoId} sem telefone válido.`
    );

    return;
  }

  /* --------------------------------------------------------
     MENSAGEM
  -------------------------------------------------------- */

  const mensagem = montarMensagemStatus({
    ...pedido,
    id: pedidoId,
  });

  console.log(
    "[BOT] STATUS ATUAL:",
    pedido.status
  );

  console.log(
    "[BOT] MENSAGEM GERADA:"
  );

  console.log(mensagem);

  if (!mensagem) {
    console.log(
      `[BOT] Status ${pedido.status} sem mensagem.`
    );

    return;
  }

  const chatId = `${telefoneNormalizado}@c.us`;

  /* --------------------------------------------------------
     VERIFICAÇÕES ANTES DO ENVIO
  -------------------------------------------------------- */

  if (
    !clienteAtual ||
    sessaoEnvio !== idSessaoWhatsapp
  ) {
    console.log(
      "[BOT] Cliente inválido antes do envio."
    );

    return;
  }

  if (!whatsappPronto) {
    console.log(
      "[BOT] WhatsApp não está pronto."
    );

    return;
  }

  console.log(
    "[BOT] Cliente pronto, enviando..."
  );

  console.log(
    "[BOT] pupPage existe:",
    !!clienteAtual.pupPage
  );

  console.log(
    "[BOT] pupPage fechada:",
    clienteAtual.pupPage?.isClosed()
  );

  console.log(
    "[BOT] Browser conectado:",
    clienteAtual.pupBrowser?.isConnected()
  );

  await aguardar(1000);

  try {
    /* ------------------------------------------------------
       ESTADO DO WHATSAPP
    ------------------------------------------------------ */

    const estado = await clienteAtual.getState();

    console.log(
      "[BOT] Estado antes envio:",
      estado
    );

    if (estado !== "CONNECTED") {
      console.log(
        "[BOT] WhatsApp não conectado."
      );

      return;
    }

    /*
     * Aguarda o WhatsApp estabilizar.
     */
    await aguardar(5000);

    const estadoAntesEnvio =
      await clienteAtual.getState();

    console.log(
      "[BOT] Estado final antes envio:",
      estadoAntesEnvio
    );

    if (estadoAntesEnvio !== "CONNECTED") {
      console.log(
        "[BOT] Cancelando envio, WhatsApp reiniciando."
      );

      return;
    }

    /* ------------------------------------------------------
       LOGS
    ------------------------------------------------------ */

    console.log(
      "[BOT] Enviando para:",
      chatId
    );

    console.log(
      "[BOT] Tamanho mensagem:",
      mensagem.length
    );

    console.log(
      "[BOT] Status:",
      pedido.status
    );

    console.log(
      "[BOT] CHAT ID:",
      chatId
    );

    console.log(
      "[BOT] STATUS:",
      pedido.status
    );

    console.log(
      "[BOT] PRIMEIROS 50 CARACTERES:",
      mensagem.substring(0, 50)
    );

    /* ------------------------------------------------------
       ENVIO
    ------------------------------------------------------ */

    await clienteAtual.sendMessage(
      chatId,
      mensagem,
      {
        sendSeen: false,
      }
    );

    console.log(
      "[BOT] WhatsApp aceitou o envio."
    );

  } catch (e) {
    console.error(
      "[BOT] Erro envio:",
      e
    );

    /*
     * MUITO IMPORTANTE:
     *
     * Não marca como notificado se o envio falhou.
     *
     * Isso permite que o pedido seja processado novamente
     * caso o status seja alterado posteriormente.
     */
    return;
  }

  /* --------------------------------------------------------
     MARCA COMO NOTIFICADO
     
     Só chega aqui se sendMessage() tiver funcionado.
  -------------------------------------------------------- */

  try {
    await db
      .collection("pedidos")
      .doc(pedidoId)
      .update({
        ultimoStatusNotificado: pedido.status,
        notificacaoWhatsappEm:
          FieldValue.serverTimestamp(),
      });
  } catch (e) {
    console.error(
      `[BOT] Mensagem foi enviada, mas não foi possível atualizar o pedido ${pedidoId}:`,
      e
    );

    /*
     * A mensagem já foi enviada.
     *
     * Não podemos reenviar automaticamente porque isso
     * poderia gerar uma mensagem duplicada.
     */
    return;
  }

  /* --------------------------------------------------------
     CONTADORES
  -------------------------------------------------------- */

  whatsappState.mensagensHoje++;

  console.log(
    `[BOT] Mensagem enviada para ${telefoneNormalizado} - pedido ${pedidoId} - status ${pedido.status}`
  );

  /* --------------------------------------------------------
     PROTEÇÃO CONTRA DUPLICAÇÃO
  -------------------------------------------------------- */

  const chaveEnvio =
    `${pedidoId}_${pedido.status}`;

  enviadosRecentemente.add(chaveEnvio);

  setTimeout(() => {
    enviadosRecentemente.delete(chaveEnvio);
  }, 60000);
}

/* ==========================================================
   LISTENER DOS PEDIDOS
========================================================== */

function iniciarListenerPedidos() {
  if (pedidosListenerIniciado) {
    console.log(
      "[BOT] Listener de pedidos já está iniciado."
    );

    return;
  }

  pedidosListenerIniciado = true;

  /*
   * Guarda o último status conhecido de cada pedido.
   *
   * Isso impede que o bot envie mensagens dos pedidos
   * antigos quando o listener iniciar.
   */
  let listenerInicializado = false;

  const statusConhecidos = new Map();

  unsubscribePedidos = db
    .collection("pedidos")
    .onSnapshot(
      async (snapshot) => {

        /* --------------------------------------------------
           PRIMEIRA LEITURA
           
           Apenas registra os pedidos existentes.
           
           NÃO envia mensagens.
        -------------------------------------------------- */

        if (!listenerInicializado) {

          for (const doc of snapshot.docs) {
            const pedido = doc.data();

            statusConhecidos.set(
              doc.id,
              pedido.status || null
            );
          }

          listenerInicializado = true;

          console.log(
            `[BOT] Listener inicializado. ${snapshot.size} pedidos existentes ignorados.`
          );

          return;
        }

        /* --------------------------------------------------
           ALTERAÇÕES FUTURAS
        -------------------------------------------------- */

        for (const change of snapshot.docChanges()) {

          const pedidoId = change.doc.id;
          const pedido = change.doc.data();

          /* -----------------------------------------------
             PEDIDO REMOVIDO
          ------------------------------------------------ */

          if (change.type === "removed") {
            statusConhecidos.delete(pedidoId);

            continue;
          }

          /* -----------------------------------------------
             SOMENTE ADDED / MODIFIED
          ------------------------------------------------ */

          if (
            change.type !== "added" &&
            change.type !== "modified"
          ) {
            continue;
          }

          const statusAtual =
            pedido.status || null;

          const statusAnterior =
            statusConhecidos.get(pedidoId) || null;

          /*
           * Atualiza o cache imediatamente.
           */
          statusConhecidos.set(
            pedidoId,
            statusAtual
          );

          /* -----------------------------------------------
             SEM STATUS
          ------------------------------------------------ */

          if (!statusAtual) {
            continue;
          }

          /* -----------------------------------------------
             PRIMEIRO ADDED DE UM NOVO PEDIDO
             
             Se o pedido acabou de ser criado, ele pode
             ser enviado caso ainda não tenha sido notificado.
             
             Para modified, exigimos mudança real de status.
          ------------------------------------------------ */

          if (
            change.type === "modified" &&
            statusAtual === statusAnterior
          ) {
            console.log(
              `[BOT] Pedido ${pedidoId} alterado sem mudança de status. Ignorando.`
            );

            continue;
          }

          /*
           * Se for added depois da inicialização, só
           * processamos se ainda não houver notificação.
           */
          if (
            change.type === "added" &&
            statusAtual === statusAnterior
          ) {
            continue;
          }

          /* -----------------------------------------------
             JÁ NOTIFICADO
          ------------------------------------------------ */

          if (
            pedido.ultimoStatusNotificado ===
            statusAtual
          ) {
            console.log(
              `[BOT] Pedido ${pedidoId} já possui notificação para ${statusAtual}.`
            );

            continue;
          }

          /* -----------------------------------------------
             WHATSAPP OFFLINE
          ------------------------------------------------ */

          if (
            !whatsappPronto ||
            reconectando
          ) {
            console.log(
              `[BOT] WhatsApp offline. Pedido ${pedidoId} aguardando.`
            );

            continue;
          }

          /* -----------------------------------------------
             CHAVE ÚNICA
          ------------------------------------------------ */

          const chaveEnvio =
            `${pedidoId}_${statusAtual}`;

          /* -----------------------------------------------
             DUPLICAÇÃO
          ------------------------------------------------ */

          if (
            enviando.has(chaveEnvio) ||
            enviadosRecentemente.has(chaveEnvio)
          ) {
            console.log(
              `[BOT] Pedido ${chaveEnvio} já processado.`
            );

            continue;
          }

          /* -----------------------------------------------
             COLOCA NA FILA
          ------------------------------------------------ */

          enviando.add(chaveEnvio);

          filaMensagens = filaMensagens
            .catch(() => {})
            .then(async () => {

              try {

                await enviarMensagemPedido(
                  pedidoId,
                  pedido
                );

              } catch (erro) {

                console.error(
                  `[BOT] Erro pedido ${pedidoId}:`,
                  erro.message
                );

              } finally {

                enviando.delete(
                  chaveEnvio
                );

              }

            });
        }
      },

      (erro) => {
        console.error(
          "[BOT] Erro ao ouvir pedidos:",
          erro
        );
      }
    );

  console.log(
    "[BOT] Listener de pedidos iniciado."
  );
}

/* ==========================================================
   LIMPAR FILA
========================================================== */

function limparFilaWhatsapp() {
  filaMensagens = Promise.resolve();

  enviando.clear();
}

/* ==========================================================
   RECONEXÃO DO WHATSAPP
========================================================== */

async function reconectarWhatsapp() {

  if (reconectando) {
    console.log(
      "[BOT] Reconexão já em andamento."
    );

    return;
  }

  reconectando = true;

  whatsappPronto = false;

  /* --------------------------------------------------------
     DESATIVA LISTENER
  -------------------------------------------------------- */

  if (unsubscribePedidos) {
    unsubscribePedidos();

    unsubscribePedidos = null;
  }

  pedidosListenerIniciado = false;

  /* --------------------------------------------------------
     GUARDA CLIENTE ANTIGO
  -------------------------------------------------------- */

  const clienteParaDestruir = client;

  client = null;

  /*
   * Invalida imediatamente qualquer operação da sessão
   * anterior.
   */
  idSessaoWhatsapp++;

  try {

    console.log(
      "[BOT] Iniciando limpeza para reconexão..."
    );

    limparFilaWhatsapp();

    /* ------------------------------------------------------
       DESTRÓI CLIENTE ANTIGO
    ------------------------------------------------------ */

    if (clienteParaDestruir) {

      console.log(
        "[BOT] Destruindo cliente WhatsApp antigo..."
      );

      try {

        await clienteParaDestruir.destroy();

        console.log(
          "[BOT] Cliente antigo destruído."
        );

      } catch (e) {

        console.log(
          "[BOT] Erro ao destruir cliente antigo:",
          e.message
        );

      }
    }

    /*
     * Dá tempo para o processo do navegador terminar.
     */
    await aguardar(3000);

    console.log(
      "[BOT] Criando novo cliente WhatsApp..."
    );

    await criarClienteWhatsapp();

  } catch (e) {

    console.error(
      "[BOT] Erro na reconexão:",
      e.message
    );

  } finally {

    reconectando = false;

  }
}

/* ==========================================================
   CRIAR CLIENTE WHATSAPP
========================================================== */

async function criarClienteWhatsapp() {

  if (inicializandoCliente) {

    console.log(
      "[BOT] Cliente já está sendo inicializado."
    );

    return;
  }

  inicializandoCliente = true;

  /* --------------------------------------------------------
     DESTRÓI CLIENTE EXISTENTE
  -------------------------------------------------------- */

  if (client) {

    console.log(
      "[BOT] Destruindo cliente antigo antes de criar."
    );

    try {

      await client.destroy();

    } catch (e) {

      console.log(
        "[BOT] Erro destruindo cliente antigo:",
        e.message
      );

    }

    client = null;
  }

  /* --------------------------------------------------------
     NOVA SESSÃO
  -------------------------------------------------------- */

  idSessaoWhatsapp++;

  clienteAnterior = client;

  client = null;

  if (clienteAnterior) {

    try {

      await clienteAnterior.destroy();

    } catch (e) {

      console.warn(
        "[BOT] Erro ao destruir cliente anterior:",
        e.message
      );

    }

    clienteAnterior = null;
  }

  /* --------------------------------------------------------
     CLIENTE
  -------------------------------------------------------- */

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

  /* --------------------------------------------------------
     QR CODE
  -------------------------------------------------------- */

  client.on("qr", async (qr) => {

    try {

      const qrBase64 =
        await QRCode.toDataURL(qr);

      atualizarEstado({

        status: "AGUARDANDO_QR",

        qrCode: qrBase64,

        numero: null,

      });

      console.log(
        "[BOT] QR Code gerado."
      );

    } catch (erro) {

      console.error(
        "[BOT] Erro ao gerar QR em base64:",
        erro
      );

    }
  });

  /* --------------------------------------------------------
     AUTHENTICATED
  -------------------------------------------------------- */

  let autenticado = false;

  client.on(
    "authenticated",
    () => {

      if (autenticado) {

        console.log(
          "[BOT] Autenticação duplicada ignorada."
        );

        return;
      }

      autenticado = true;

      atualizarEstado({
        status: "AUTENTICADO",
      });

      console.log(
        "[BOT] WhatsApp autenticado."
      );
    }
  );

  /* --------------------------------------------------------
     CLIENTE ATUAL
  -------------------------------------------------------- */

  let prontoDisparado = false;

  const clienteAtual = client;

  /* --------------------------------------------------------
     DISCONNECTED
     
     Log simples.
  -------------------------------------------------------- */

  clienteAtual.on(
    "disconnected",
    (reason) => {

      console.log(
        "[BOT] Evento disconnected:",
        reason
      );

    }
  );

  /* --------------------------------------------------------
     CHANGE STATE
  -------------------------------------------------------- */

  clienteAtual.on(
    "change_state",
    (state) => {

      console.log(
        "[BOT] Estado:",
        state
      );

    }
  );

  clienteAtual.on(
    "loading_screen",
    (percent, message) => {

      console.log(
        `[BOT] Carregando WhatsApp ${percent}% - ${message}`
      );

    }
  );

  clienteAtual.on(
    "change_state",
    async (state) => {

      console.log(
        "[BOT] Estado WhatsApp:",
        state
      );

      if (state !== "CONNECTED") {
        whatsappPronto = false;
      }

    }
  );

  /* --------------------------------------------------------
     READY
  -------------------------------------------------------- */

  clienteAtual.on(
    "ready",
    async () => {

      if (prontoDisparado) {

        console.log(
          "[BOT] Evento ready duplicado ignorado."
        );

        return;
      }

      prontoDisparado = true;

      let numero = null;

      try {

        const info = clienteAtual.info;

        numero =
          info?.wid?.user || null;

      } catch (e) {

        console.warn(
          "[BOT] Não foi possível obter número da sessão."
        );

      }

      /*
       * Aguarda o WhatsApp estabilizar.
       */
      await aguardar(5000);

      try {

        const estado =
          await clienteAtual.getState();

        console.log(
          "[BOT] Estado após estabilizar:",
          estado
        );

        if (estado !== "CONNECTED") {

          console.log(
            "[BOT] WhatsApp ainda instável."
          );

          return;
        }

      } catch (e) {

        console.error(
          "[BOT] Erro verificando estado após ready:",
          e.message
        );

        return;
      }

      /* ----------------------------------------------------
         WHATSAPP PRONTO
      ---------------------------------------------------- */

      whatsappPronto = true;

      atualizarEstado({

        status: "CONECTADO",

        numero,

        qrCode: null,

      });

      console.log(
        "[BOT] WhatsApp pronto!"
      );

      /* ----------------------------------------------------
         INICIA LISTENER
      ---------------------------------------------------- */

      iniciarListenerPedidos();

    }
  );

  /* --------------------------------------------------------
     BROWSER CLOSED
  -------------------------------------------------------- */

  clienteAtual.on(
    "browser_closed",
    () => {

      console.log(
        "[BOT] Browser do WhatsApp foi fechado."
      );

    }
  );

  /* --------------------------------------------------------
     AUTH FAILURE
  -------------------------------------------------------- */

  client.on(
    "auth_failure",
    (msg) => {

      atualizarEstado({

        status: "FALHA_AUTENTICACAO",

        qrCode: null,

      });

      console.error(
        "[BOT] Falha na autenticação:",
        msg
      );

    }
  );

  /* --------------------------------------------------------
     DISCONNECTED
     
     Reconexão automática.
  -------------------------------------------------------- */

  const clienteDesconectado = client;

  clienteDesconectado.on(
    "disconnected",
    async (reason) => {

      /*
       * Se esse cliente não é mais o cliente atual,
       * não deve iniciar uma nova reconexão.
       */
      if (
        client !== clienteDesconectado &&
        client !== null
      ) {

        console.log(
          "[BOT] Sessão antiga desconectada. Ignorando reconexão."
        );

        return;
      }

      whatsappPronto = false;

      atualizarEstado({

        status: "DESCONECTADO",

        numero: null,

        qrCode: null,

      });

      console.warn(
        "[BOT] WhatsApp desconectado:",
        reason
      );

      if (clienteDesconectado) {

        try {

          console.log(
            "[BOT] Encerrando navegador antigo..."
          );

          if (
            clienteDesconectado.pupBrowser
          ) {

            await clienteDesconectado.destroy();

            console.log(
              "[BOT] Navegador encerrado."
            );

          }

        } catch (e) {

          console.log(
            "[BOT] Erro destruindo sessão:",
            e.message
          );

        }

      }

      /*
       * Só limpa a referência se ainda for
       * o cliente atual.
       */
      if (
        client === clienteDesconectado
      ) {

        client = null;

      }

      if (!reconectando) {

        setTimeout(
          () => {

            console.log(
              "[BOT] Tentando reconectar..."
            );

            reconectarWhatsapp();

          },
          5000
        );

      }

    }
  );

  /* --------------------------------------------------------
     INITIALIZE
  -------------------------------------------------------- */

  try {

    console.log(
      "[BOT] Chamando initialize do WhatsApp..."
    );

    await client.initialize();

  } catch (erro) {

    console.error(
      "[BOT] Erro ao inicializar:",
      erro.message
    );

  } finally {

    inicializandoCliente = false;

  }
}

/* ==========================================================
   ROTAS API
========================================================== */

/* ----------------------------------------------------------
   STATUS WHATSAPP
---------------------------------------------------------- */

app.get(
  "/api/whatsapp/status",
  (req, res) => {

    res.json({

      success: true,

      ...whatsappState,

    });

  }
);

/* ----------------------------------------------------------
   RECONEXÃO MANUAL
---------------------------------------------------------- */

app.post(
  "/api/whatsapp/reconnect",
  async (req, res) => {

    try {

      atualizarEstado({

        status: "RECONECTANDO",

        qrCode: null,

        numero: null,

      });

      /*
       * Não aguardamos a conclusão de toda a inicialização
       * para responder à API.
       */
      reconectarWhatsapp();

      res.json({

        success: true,

        message: "Reconexão iniciada.",

      });

    } catch (erro) {

      console.error(
        "[BOT] Erro ao reconectar:",
        erro
      );

      res.status(500).json({

        success: false,

        message:
          "Erro ao reconectar WhatsApp.",

      });

    }

  }
);

/* ----------------------------------------------------------
   BEE — SOLICITAR ENTREGADOR
---------------------------------------------------------- */

app.post(
  "/api/bee/solicitar-entrega",
  async (req, res) => {

    try {

      const resposta =
        await solicitarEntregador(
          req.body.pedido
        );

      res.json({

        success: true,

        resposta,

      });

    } catch (error) {

      console.error(
        "[BEE]",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Erro ao solicitar entregador",

      });

    }

  }
);

/* ==========================================================
   START
========================================================== */

const PORT = 3001;

app.listen(
  PORT,
  () => {

    console.log(
      `🚀 API do WhatsApp rodando em http://localhost:${PORT}`
    );

  }
);

criarClienteWhatsapp().catch(
  (erro) => {

    console.error(
      "[BOT] Erro fatal ao criar cliente WhatsApp:",
      erro
    );

  }
);