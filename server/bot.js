const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const fs = require("fs");
const { execFile } = require("child_process");
const path = require("path");
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

let botEncerrando = false;

let client = null;

let clienteParaLimpeza = null;

let whatsappPronto = false;

let inicializandoCliente = false;

let reconectando = false;

let reconexaoAgendada = false;

let idSessaoWhatsapp = 0;

let timerReconexao = null;

let destruindoCliente = false;

let tentativaReconexao = 0;

let reconexaoManual = false;

const MAX_TENTATIVAS_RECONEXAO = 5;

const TEMPO_RECONEXAO_MS = 15000;

let inicializacaoEmAndamento = null;
let destruicaoEmAndamento = null;

/* ==========================================================
   LISTENER DOS PEDIDOS
========================================================== */

let pedidosListenerIniciado = false;
let unsubscribePedidos = null;

/* ==========================================================
   FILA
========================================================== */

let filaMensagens = Promise.resolve();

const enviando = new Set();

const enviadosRecentemente = new Set();

/*
 * Pedidos que precisam ser processados quando o WhatsApp
 * voltar.
 *
 * Chave:
 *
 * pedidoId_status
 */
const filaPedidosPendentes = new Map();

/* ==========================================================
   LOCK DO BOT
========================================================== */

/*
 * Impede duas instâncias de bot.js de utilizarem
 * simultaneamente a mesma sessão do WhatsApp.
 *
 * NÃO mexe no .wwebjs_auth.
 * NÃO apaga SingletonLock.
 */

const arquivoLock = path.join(__dirname, ".bot-instance.lock");

let lockFd = null;

function obterPidDoLock() {
  try {
    const conteudo = fs.readFileSync(arquivoLock, "utf8");

    const pid = Number(String(conteudo).trim());

    return Number.isInteger(pid) ? pid : null;
  } catch {
    return null;
  }
}

function processoExiste(pid) {
  if (!pid || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function adquirirLockBot() {
  try {
    lockFd = fs.openSync(arquivoLock, "wx");

    fs.writeFileSync(lockFd, String(process.pid), "utf8");

    console.log(`[BOT] Lock adquirido. PID ${process.pid}.`);

    return true;
  } catch (erro) {
    if (erro.code !== "EEXIST") {
      throw erro;
    }

    const pidAnterior = obterPidDoLock();

    if (
      pidAnterior &&
      pidAnterior !== process.pid &&
      processoExiste(pidAnterior)
    ) {
      console.error(
        `[BOT] Outra instância do bot já está em execução. PID ${pidAnterior}.`,
      );

      return false;
    }

    /*
     * O arquivo existe, mas o processo não existe mais.
     *
     * O lock é do nosso bot, portanto podemos remover
     * somente este arquivo de controle.
     *
     * NÃO tocamos na sessão do WhatsApp.
     */

    console.warn(
      "[BOT] Lock antigo encontrado sem processo correspondente. Removendo apenas o lock do bot.",
    );

    try {
      fs.unlinkSync(arquivoLock);
    } catch (e) {
      console.error("[BOT] Não foi possível remover lock antigo:", e.message);

      return false;
    }

    return adquirirLockBot();
  }
}

function liberarLockBot() {
  if (lockFd !== null) {
    try {
      fs.closeSync(lockFd);
    } catch {}
    lockFd = null;
  }

  try {
    if (fs.existsSync(arquivoLock)) {
      const pid = obterPidDoLock();

      if (!pid || pid === process.pid) {
        fs.unlinkSync(arquivoLock);
      }
    }
  } catch (erro) {
    console.error("[BOT] Erro ao liberar lock:", erro.message);
  }
}

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
    mensagem.includes("Execution context") ||
    mensagem.includes("Session closed")
  );
}

/* ==========================================================
   TELEFONE
========================================================== */

function normalizarTelefone(telefone) {
  if (!telefone) return null;

  let numero = String(telefone).replace(/\D/g, "");

  numero = numero.replace(/^0+/, "");

  if (numero.length === 9) {
    numero = `19${numero}`;
  }

  if (numero.length === 8) {
    numero = `19${numero}`;
  }

  if (numero.length === 10 || numero.length === 11) {
    numero = `55${numero}`;
  }

  if (
    !numero.startsWith("55") &&
    (numero.length === 10 || numero.length === 11)
  ) {
    numero = `55${numero}`;
  }

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

    case "SAIU_PARA_ENTREGA":
      return `Olá *${cliente}*!

🚚 Seu pedido *#${numeroPedido}* saiu para entrega.

Você pode acompanhar o andamento do seu pedido pelo link:

${linkPedido}

Obrigado pela preferência!`;

    case "CANCELADO":
      return `Olá *${cliente}*!

❌ Infelizmente seu pedido *#${numeroPedido}* foi cancelado.

Caso tenha dúvidas, entre em contato conosco.`;

    default:
      return null;
  }
}

/* ==========================================================
   CHAVE DA FILA
========================================================== */

function chavePedido(pedidoId, status) {
  return `${pedidoId}_${status}`;
}

/* ==========================================================
   ADICIONAR PEDIDO À FILA
========================================================== */

function adicionarPedidoFila(pedidoId, pedido) {
  const status = pedido?.status;

  if (!status) {
    return;
  }

  if (pedido.ultimoStatusNotificado === status) {
    return;
  }

  const chave = chavePedido(pedidoId, status);

  if (
    enviando.has(chave) ||
    enviadosRecentemente.has(chave) ||
    filaPedidosPendentes.has(chave)
  ) {
    return;
  }

  filaPedidosPendentes.set(chave, {
    pedidoId,
    status,
  });

  console.log(`[BOT] Pedido ${pedidoId} status ${status} adicionado à fila.`);

  processarFilaPedidos();
}

/* ==========================================================
   PROCESSAR FILA
========================================================== */

function processarFilaPedidos() {
  if (!whatsappPronto || reconectando || !client) {
    return;
  }

  filaMensagens = filaMensagens
    .catch(() => {})
    .then(async () => {
      /*
       * Processa a fila em sequência.
       *
       * Enquanto um envio estiver ocorrendo,
       * outro não começa.
       */

      while (
        whatsappPronto &&
        !reconectando &&
        client &&
        filaPedidosPendentes.size > 0
      ) {
        const entrada = filaPedidosPendentes.entries().next().value;

        if (!entrada) {
          break;
        }

        const [chave, dados] = entrada;

        filaPedidosPendentes.delete(chave);

        const { pedidoId, status } = dados;

        const chaveEnvio = chavePedido(pedidoId, status);

        if (enviando.has(chaveEnvio)) {
          continue;
        }

        if (enviadosRecentemente.has(chaveEnvio)) {
          continue;
        }

        enviando.add(chaveEnvio);

        try {
          await enviarMensagemPedido(pedidoId, {
            id: pedidoId,
            status,
          });
        } catch (erro) {
          console.error(`[BOT] Erro ao processar pedido ${pedidoId}:`, erro);

          /*
           * Se o WhatsApp caiu durante o envio,
           * recoloca na fila.
           */

          if (!whatsappPronto || reconectando) {
            filaPedidosPendentes.set(chaveEnvio, {
              pedidoId,
              status,
            });
          }
        } finally {
          enviando.delete(chaveEnvio);
        }
      }
    });
}

/* ==========================================================
   ENVIO DE MENSAGEM
========================================================== */

async function enviarMensagemPedido(pedidoId, referencia) {
  const clienteAtual = client;

  const sessaoEnvio = idSessaoWhatsapp;

  if (!clienteAtual || !whatsappPronto || reconectando) {
    console.log(
      `[BOT] WhatsApp offline. Pedido ${pedidoId} permanece aguardando.`,
    );

    throw new Error("WhatsApp offline.");
  }

  /*
   * Consulta novamente o Firestore.
   */

  const doc = await db.collection("pedidos").doc(pedidoId).get();

  if (!doc.exists) {
    console.log(`[BOT] Pedido ${pedidoId} não existe mais.`);

    return;
  }

  const pedido = doc.data();

  const statusAtual = pedido.status;

  /*
   * Se o status mudou desde que entrou na fila,
   * não enviamos o status antigo.
   *
   * O novo status será colocado na fila pelo
   * listener ou pela reconciliação.
   */

  if (referencia.status && statusAtual !== referencia.status) {
    console.log(
      `[BOT] Pedido ${pedidoId} mudou de ${referencia.status} para ${statusAtual} antes do envio.`,
    );

    if (statusAtual && pedido.ultimoStatusNotificado !== statusAtual) {
      adicionarPedidoFila(pedidoId, pedido);
    }

    return;
  }

  /*
   * Já foi notificado.
   */

  if (pedido.ultimoStatusNotificado === statusAtual) {
    console.log(
      `[BOT] Pedido ${pedidoId} já foi notificado para ${statusAtual}.`,
    );

    return;
  }

  /*
   * Verifica se ainda é a mesma sessão.
   */

  if (sessaoEnvio !== idSessaoWhatsapp || client !== clienteAtual) {
    throw new Error("Sessão WhatsApp substituída durante o processamento.");
  }

  /*
   * TELEFONE
   */

  const telefoneNormalizado =
    pedido.telefoneWhatsapp || normalizarTelefone(pedido.telefone);

  if (!telefoneNormalizado) {
    console.log(`[BOT] Pedido ${pedidoId} sem telefone válido.`);

    return;
  }

  /*
   * MENSAGEM
   */

  const mensagem = montarMensagemStatus({
    ...pedido,
    id: pedidoId,
  });

  if (!mensagem) {
    console.log(`[BOT] Status ${statusAtual} sem mensagem configurada.`);

    return;
  }

  const chatId = `${telefoneNormalizado}@c.us`;

  /*
   * ESTADO DO WHATSAPP
   */

  try {
    const estado = await clienteAtual.getState();

    console.log(`[BOT] Estado antes do envio do pedido ${pedidoId}: ${estado}`);

    if (estado !== "CONNECTED") {
      whatsappPronto = false;

      throw new Error("WhatsApp não está CONNECTED.");
    }
  } catch (erro) {
    if (ehErroFrame(erro)) {
      whatsappPronto = false;
    }

    throw erro;
  }

  /*
   * Pequeno intervalo para estabilização.
   */

  await aguardar(1000);

  /*
   * Confere novamente a sessão.
   */

  if (
    client !== clienteAtual ||
    sessaoEnvio !== idSessaoWhatsapp ||
    !whatsappPronto ||
    reconectando
  ) {
    throw new Error("Sessão não está mais disponível.");
  }

  console.log(
    `[BOT] Enviando WhatsApp para ${chatId} - pedido ${pedidoId} - status ${statusAtual}`,
  );

  /*
   * ENVIO
   */

  try {
    await clienteAtual.sendMessage(chatId, mensagem, {
      sendSeen: false,
    });
  } catch (erro) {
    console.error(`[BOT] Erro no envio do pedido ${pedidoId}:`, erro);

    if (ehErroFrame(erro)) {
      whatsappPronto = false;
    }

    throw erro;
  }

  console.log(`[BOT] WhatsApp aceitou o envio do pedido ${pedidoId}.`);

  /*
   * MARCA COMO NOTIFICADO.
   *
   * Tentamos algumas vezes porque a mensagem já foi
   * aceita pelo WhatsApp.
   */

  let atualizado = false;
  let ultimoErro = null;

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      await db.collection("pedidos").doc(pedidoId).update({
        ultimoStatusNotificado: statusAtual,

        notificacaoWhatsappEm: FieldValue.serverTimestamp(),
      });

      atualizado = true;

      break;
    } catch (erro) {
      ultimoErro = erro;

      console.error(
        `[BOT] Falha ao registrar notificação do pedido ${pedidoId} (tentativa ${tentativa}/3):`,
        erro,
      );

      if (tentativa < 3) {
        await aguardar(1000 * tentativa);
      }
    }
  }

  if (!atualizado) {
    /*
     * A mensagem foi enviada, mas o Firestore não
     * confirmou o registro.
     *
     * NÃO colocamos novamente na fila automaticamente,
     * porque isso poderia duplicar a mensagem.
     */

    console.error(
      `[BOT] ATENÇÃO: mensagem do pedido ${pedidoId} foi enviada, mas não foi possível registrar ultimoStatusNotificado.`,
      ultimoErro,
    );

    return;
  }

  /*
   * CONTADORES
   */

  whatsappState.mensagensHoje++;

  const chave = chavePedido(pedidoId, statusAtual);

  enviadosRecentemente.add(chave);

  setTimeout(() => {
    enviadosRecentemente.delete(chave);
  }, 60000);

  console.log(
    `[BOT] Mensagem enviada com sucesso - pedido ${pedidoId} - status ${statusAtual}`,
  );
}

/* ==========================================================
   RECONCILIAR PEDIDOS
========================================================== */

/*
 * Na inicialização do bot, NÃO devemos reenviar pedidos antigos.
 *
 * A reconciliação serve apenas para estabelecer o último status
 * conhecido dos pedidos que ainda não possuem
 * ultimoStatusNotificado.
 *
 * Depois que o bot estiver funcionando, alterações de status
 * serão tratadas normalmente pelo listener.
 */

async function reconciliarPedidosPendentes() {
  if (!whatsappPronto || !client || reconectando) {
    return;
  }

  console.log("[BOT] Sincronizando status atuais dos pedidos...");

  try {
    const snapshot = await db.collection("pedidos").get();

    let sincronizados = 0;

    for (const doc of snapshot.docs) {
      const pedido = doc.data();

      if (!pedido.status) {
        continue;
      }

      /*
       * Pedido que ainda não possui um status notificado.
       *
       * Na primeira inicialização, consideramos o status atual
       * como já conhecido para NÃO enviar mensagens antigas.
       */
      if (
        pedido.ultimoStatusNotificado === undefined ||
        pedido.ultimoStatusNotificado === null ||
        pedido.ultimoStatusNotificado === ""
      ) {
        await doc.ref.update({
          ultimoStatusNotificado: pedido.status,
        });

        sincronizados++;

        console.log(
          `[BOT] Pedido ${doc.id} sincronizado no status ${pedido.status} sem envio.`,
        );

        continue;
      }

      /*
       * Se já existe ultimoStatusNotificado, não fazemos nada aqui.
       *
       * Mudanças futuras serão detectadas pelo listener.
       */
    }

    console.log(
      `[BOT] Sincronização concluída. ${sincronizados} pedido(s) inicializado(s) sem envio.`,
    );
  } catch (erro) {
    console.error("[BOT] Erro ao sincronizar pedidos:", erro);
  }
}

/* ==========================================================
   LISTENER DOS PEDIDOS
========================================================== */

function iniciarListenerPedidos() {
  if (pedidosListenerIniciado) {
    console.log("[BOT] Listener de pedidos já está iniciado.");

    return;
  }

  pedidosListenerIniciado = true;

  let listenerInicializado = false;

  const statusConhecidos = new Map();

  unsubscribePedidos = db.collection("pedidos").onSnapshot(
    (snapshot) => {
      /*
       * PRIMEIRA LEITURA
       *
       * Não enviamos tudo automaticamente aqui.
       *
       * A reconciliação do READY cuida dos pedidos
       * pendentes.
       */

      if (!listenerInicializado) {
        for (const doc of snapshot.docs) {
          const pedido = doc.data();

          statusConhecidos.set(doc.id, pedido.status || null);
        }

        listenerInicializado = true;

        console.log(
          `[BOT] Listener inicializado. ${snapshot.size} pedidos carregados.`,
        );

        return;
      }

      /*
       * ALTERAÇÕES
       */

      for (const change of snapshot.docChanges()) {
        const pedidoId = change.doc.id;

        /*
         * REMOVIDO
         */

        if (change.type === "removed") {
          statusConhecidos.delete(pedidoId);

          /*
           * Remove possíveis entradas antigas
           * desse pedido da fila.
           */

          for (const [chave, dados] of filaPedidosPendentes) {
            if (dados.pedidoId === pedidoId) {
              filaPedidosPendentes.delete(chave);
            }
          }

          continue;
        }

        const pedido = change.doc.data();

        const statusAtual = pedido.status || null;

        const statusAnterior = statusConhecidos.get(pedidoId) || null;

        statusConhecidos.set(pedidoId, statusAtual);

        if (!statusAtual) {
          continue;
        }

        /*
         * ADDED
         *
         * Um pedido criado depois que o listener
         * já está funcionando deve ser processado.
         */

        if (change.type === "added") {
          if (pedido.ultimoStatusNotificado !== statusAtual) {
            adicionarPedidoFila(pedidoId, pedido);
          }

          continue;
        }

        /*
         * MODIFIED sem mudança de status.
         *
         * Alterações como:
         *
         * ultimoStatusNotificado
         * notificacaoWhatsappEm
         *
         * não devem gerar nova notificação.
         */

        if (change.type === "modified" && statusAtual === statusAnterior) {
          continue;
        }

        /*
         * Status mudou.
         */

        if (pedido.ultimoStatusNotificado !== statusAtual) {
          adicionarPedidoFila(pedidoId, pedido);
        }
      }

      processarFilaPedidos();
    },

    (erro) => {
      console.error("[BOT] Erro ao ouvir pedidos:", erro);

      /*
       * Permite tentar iniciar novamente caso o
       * listener seja perdido.
       */

      pedidosListenerIniciado = false;

      unsubscribePedidos = null;
    },
  );

  console.log("[BOT] Listener de pedidos iniciado.");
}

/* ==========================================================
   PARAR LISTENER
========================================================== */

function pararListenerPedidos() {
  if (unsubscribePedidos) {
    try {
      unsubscribePedidos();
    } catch {}
  }

  unsubscribePedidos = null;

  pedidosListenerIniciado = false;
}

/* ==========================================================
   LIMPAR FILA
========================================================== */

function limparFilaWhatsapp() {
  filaMensagens = Promise.resolve();

  enviando.clear();

  /*
   * NÃO apagamos filaPedidosPendentes aqui.
   *
   * Os pedidos precisam continuar aguardando.
   */
}

/* ==========================================================
   DESTRUIR CLIENTE WHATSAPP
========================================================== */

async function destruirClienteWhatsapp(cliente, motivo = "desconhecido") {
  /*
   * Se já existe uma destruição, todos os chamadores
   * aguardam exatamente a mesma operação.
   */
  if (destruicaoEmAndamento) {
    console.log(
      `[BOT] Aguardando destruição de cliente já em andamento. Motivo: ${motivo}`,
    );

    return destruicaoEmAndamento;
  }

  if (!cliente) {
    return;
  }

  destruindoCliente = true;

  const promessa = (async () => {
    try {
      console.log(`[BOT] Encerrando cliente WhatsApp (${motivo})...`);

      /*
       * Guarda o browser ANTES de remover listeners
       * ou chamar destroy().
       */
      const browser = cliente.pupBrowser || null;

      /*
       * Remove os listeners para impedir que a própria
       * destruição gere outro ciclo de reconexão.
       */
      try {
        cliente.removeAllListeners();
      } catch (erro) {
        console.warn(
          "[BOT] Não foi possível remover listeners do cliente:",
          erro?.message || String(erro),
        );
      }

      let destroyConcluido = false;

      try {
        await Promise.race([
          cliente.destroy(),

          new Promise((_, reject) => {
            setTimeout(() => {
              reject(
                new Error("Timeout aguardando client.destroy() terminar."),
              );
            }, 10000);
          }),
        ]);

        destroyConcluido = true;

        console.log(
          `[BOT] Cliente WhatsApp destruído normalmente (${motivo}).`,
        );
      } catch (erroDestroy) {
        console.error(`[BOT] Erro/timeout ao destruir cliente (${motivo}):`);

        console.error("message:", erroDestroy?.message || String(erroDestroy));

        console.error("stack:", erroDestroy?.stack || "Stack indisponível");
      }

      /*
       * Se destroy() falhou ou expirou, tenta o browser
       * diretamente.
       */
      if (!destroyConcluido && browser) {
        console.warn(
          "[BOT] client.destroy() não encerrou o Chromium. Tentando browser.close()...",
        );

        try {
          await Promise.race([
            browser.close(),

            new Promise((_, reject) => {
              setTimeout(() => {
                reject(new Error("Timeout aguardando browser.close()."));
              }, 5000);
            }),
          ]);

          console.log("[BOT] Chromium encerrado através do Puppeteer.");
        } catch (erroBrowser) {
          console.error("[BOT] browser.close() também falhou:");

          console.error(
            "message:",
            erroBrowser?.message || String(erroBrowser),
          );

          console.error("stack:", erroBrowser?.stack || "Stack indisponível");

          /*
           * Último recurso para o browser pertencente
           * a este cliente.
           */
          try {
            const processo =
              typeof browser.process === "function" ? browser.process() : null;

            const pid = processo?.pid || null;

            if (pid) {
              console.warn(
                `[BOT] Chromium ainda ativo. Encerrando processo PID ${pid}...`,
              );

              try {
                processo.kill();
              } catch (erroKill) {
                console.error("[BOT] Falha ao finalizar processo Chromium:");

                console.error(
                  "message:",
                  erroKill?.message || String(erroKill),
                );

                console.error(
                  "stack:",
                  erroKill?.stack || "Stack indisponível",
                );
              }
            }
          } catch (erroProcesso) {
            console.error("[BOT] Não foi possível obter o processo Chromium:");

            console.error(
              "message:",
              erroProcesso?.message || String(erroProcesso),
            );

            console.error(
              "stack:",
              erroProcesso?.stack || "Stack indisponível",
            );
          }
        }
      }
    } finally {
      destruindoCliente = false;
      destruicaoEmAndamento = null;
    }
  })();

  destruicaoEmAndamento = promessa;

  return promessa;
}

/* ==========================================================
   RECONEXÃO
========================================================== */

async function reconectarWhatsapp({ manual = false } = {}) {
  if (botEncerrando) {
    console.log("[BOT] Bot está sendo encerrado. Reconexão ignorada.");

    return;
  }

  if (manual) {
    reconexaoManual = true;
    tentativaReconexao = 0;

    if (timerReconexao) {
      clearTimeout(timerReconexao);

      timerReconexao = null;
    }

    reconexaoAgendada = false;
  }

  if (reconectando) {
    console.log(
      "[BOT] Reconexão já está em andamento. Ignorando nova solicitação.",
    );

    return;
  }

  reconectando = true;
  whatsappPronto = false;

  atualizarEstado({
    status: "RECONECTANDO",
    qrCode: null,
    numero: null,
  });

  pararListenerPedidos();

  /*
   * Captura o cliente atual ANTES de invalidá-lo.
   */
  const clienteParaDestruir = client;

  /*
   * Invalida imediatamente os eventos antigos.
   */
  client = null;

  idSessaoWhatsapp++;

  try {
    console.log("[BOT] Iniciando limpeza para reconexão...");

    limparFilaWhatsapp();

    /*
     * Destrói o cliente antigo antes de qualquer
     * tentativa de criação.
     */
    if (clienteParaDestruir) {
      await destruirClienteWhatsapp(clienteParaDestruir, "reconexão");
    }

    /*
     * Se outra rotina já iniciou uma destruição,
     * aguarda a mesma Promise.
     */
    if (destruicaoEmAndamento) {
      console.log("[BOT] Aguardando conclusão da destruição do Chromium...");

      await destruicaoEmAndamento;
    }

    /*
     * Se uma inicialização anterior ainda existir,
     * nunca cria outro cliente em paralelo.
     */
    if (inicializacaoEmAndamento) {
      console.log("[BOT] Aguardando conclusão da inicialização anterior...");

      try {
        await inicializacaoEmAndamento;
      } catch {
        /*
         * O erro já foi registrado pela própria
         * criarClienteWhatsapp().
         */
      }
    }

    if (botEncerrando) {
      return;
    }

    /*
     * Cria somente depois de toda destruição/
     * inicialização anterior terminar.
     */
    console.log("[BOT] Criando novo cliente WhatsApp...");

    await criarClienteWhatsapp();
  } catch (erro) {
    console.error("[BOT] Erro durante reconexão:");

    console.error("message:", erro?.message || String(erro));

    console.error("stack:", erro?.stack || "Stack indisponível");

    /*
     * ESTE é o único ponto que agenda o próximo retry
     * quando a própria tentativa falha.
     */
    if (!whatsappPronto && !reconexaoAgendada && !botEncerrando) {
      agendarReconexao();
    }
  } finally {
    reconectando = false;
    reconexaoManual = false;
  }
}

/* ==========================================================
   AGENDAR RECONEXÃO
========================================================== */

function agendarReconexao() {
  if (botEncerrando || whatsappPronto) {
    return;
  }

  if (reconectando) {
    console.log(
      "[BOT] Reconexão ainda está em andamento. Não agendando outra.",
    );

    return;
  }

  if (timerReconexao) {
    console.log("[BOT] Já existe uma reconexão agendada.");

    return;
  }

  if (tentativaReconexao >= MAX_TENTATIVAS_RECONEXAO) {
    reconexaoAgendada = false;

    atualizarEstado({
      status: "ERRO_RECONEXAO",
      qrCode: null,
      numero: null,
    });

    console.error(
      `[BOT] Limite de ${MAX_TENTATIVAS_RECONEXAO} tentativas de reconexão atingido.`,
    );

    console.error("[BOT] Nenhum novo cliente será criado automaticamente.");

    console.error(
      "[BOT] Use /api/whatsapp/reconnect para iniciar uma nova sequência manual.",
    );

    return;
  }

  tentativaReconexao++;

  reconexaoAgendada = true;

  console.log(
    `[BOT] Reconexão ${tentativaReconexao}/${MAX_TENTATIVAS_RECONEXAO} agendada para ${TEMPO_RECONEXAO_MS / 1000}s.`,
  );

  timerReconexao = setTimeout(async () => {
    timerReconexao = null;
    reconexaoAgendada = false;

    if (botEncerrando || whatsappPronto || reconectando) {
      return;
    }

    console.log(
      `[BOT] Tentando reconectar WhatsApp (${tentativaReconexao}/${MAX_TENTATIVAS_RECONEXAO})...`,
    );

    await reconectarWhatsapp();
  }, TEMPO_RECONEXAO_MS);
}

/* ==========================================================
   CRIAR CLIENTE WHATSAPP
========================================================== */

async function criarClienteWhatsapp() {
  /*
   * Se já existe uma inicialização, todos aguardam
   * exatamente a mesma Promise.
   */
  if (inicializacaoEmAndamento) {
    console.log(
      "[BOT] Já existe uma inicialização do WhatsApp em andamento. Aguardando a mesma operação.",
    );

    return inicializacaoEmAndamento;
  }

  /*
   * Nunca cria um segundo cliente.
   */
  if (client) {
    console.log("[BOT] Cliente WhatsApp já existe. Nova criação ignorada.");

    return;
  }

  /*
   * Nunca cria cliente durante destruição.
   */
  if (destruicaoEmAndamento) {
    console.log(
      "[BOT] Aguardando destruição do cliente anterior antes de criar novo cliente...",
    );

    await destruicaoEmAndamento;
  }

  /*
   * Verificação novamente depois da espera.
   */
  if (client) {
    console.log(
      "[BOT] Cliente WhatsApp já existe após aguardar destruição. Nova criação ignorada.",
    );

    return;
  }

  if (destruicaoEmAndamento) {
    await destruicaoEmAndamento;
  }

  if (destruindoCliente) {
    console.log(
      "[BOT] Um cliente ainda está sendo destruído. Nova criação ignorada.",
    );

    return;
  }

  /*
   * Nunca criar durante encerramento do bot.
   */
  if (botEncerrando) {
    console.log("[BOT] Bot está sendo encerrado. Nova criação ignorada.");

    return;
  }

  /*
   * A Promise é criada ANTES de qualquer operação assíncrona
   * da inicialização.
   *
   * Assim nenhuma chamada concorrente pode escapar da trava.
   */
  let resolverInicializacao;
  let rejeitadorInicializacao;

  inicializacaoEmAndamento = new Promise((resolve, reject) => {
    resolverInicializacao = resolve;
    rejeitadorInicializacao = reject;
  });

  inicializandoCliente = true;

  const sessaoAtual = ++idSessaoWhatsapp;

  const executarInicializacao = async () => {
    const caminhoChrome = path.resolve(
      __dirname,
      ".puppeteer",
      "chrome-win64",
      "chrome.exe",
    );

    if (!fs.existsSync(caminhoChrome)) {
      throw new Error(
        `[BOT] Chrome for Testing não encontrado em: ${caminhoChrome}\n` +
          `[BOT] Execute: npm.cmd run install-chrome`,
      );
    }

    console.log("[BOT] Chrome for Testing:", caminhoChrome);

    const novoCliente = new Client({
      authStrategy: new LocalAuth({
        clientId: "mesa-facil",
        dataPath: path.resolve(__dirname, ".wwebjs_auth"),
      }),

      puppeteer: {
        executablePath: caminhoChrome,

        headless: true,

        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      },
    });

    client = novoCliente;

    // RESTANTE DA SUA FUNÇÃO...

    let prontoDisparado = false;
    let autenticado = false;

    /*
     * QR
     */
    novoCliente.on("qr", async (qr) => {
      if (client !== novoCliente || sessaoAtual !== idSessaoWhatsapp) {
        return;
      }

      try {
        const qrBase64 = await QRCode.toDataURL(qr);

        if (client !== novoCliente || sessaoAtual !== idSessaoWhatsapp) {
          return;
        }

        atualizarEstado({
          status: "AGUARDANDO_QR",
          qrCode: qrBase64,
          numero: null,
        });

        console.log("[BOT] QR Code gerado.");
      } catch (erro) {
        console.error("[BOT] Erro ao gerar QR:");

        console.error("message:", erro?.message || String(erro));

        console.error("stack:", erro?.stack || "Stack indisponível");
      }
    });

    /*
     * AUTHENTICATED
     */
    novoCliente.on("authenticated", () => {
      if (client !== novoCliente || sessaoAtual !== idSessaoWhatsapp) {
        return;
      }

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

    /*
     * LOADING
     */
    novoCliente.on("loading_screen", (percent, message) => {
      if (client !== novoCliente || sessaoAtual !== idSessaoWhatsapp) {
        return;
      }

      console.log(`[BOT] Carregando WhatsApp ${percent}% - ${message}`);
    });

    /*
     * CHANGE STATE
     */
    novoCliente.on("change_state", (state) => {
      if (client !== novoCliente || sessaoAtual !== idSessaoWhatsapp) {
        return;
      }

      console.log("[BOT] Estado WhatsApp:", state);

      if (state !== "CONNECTED") {
        whatsappPronto = false;

        atualizarEstado({
          status: "DESCONECTADO",
        });
      }
    });

    /*
     * READY
     */
    novoCliente.on("ready", async () => {
      if (client !== novoCliente || sessaoAtual !== idSessaoWhatsapp) {
        console.log("[BOT] READY de cliente antigo ignorado.");

        return;
      }

      if (prontoDisparado) {
        console.log("[BOT] READY duplicado ignorado.");

        return;
      }

      try {
        await aguardar(3000);

        if (client !== novoCliente || sessaoAtual !== idSessaoWhatsapp) {
          return;
        }

        const estado = await novoCliente.getState();

        console.log("[BOT] Estado após estabilização:", estado);

        if (estado !== "CONNECTED") {
          whatsappPronto = false;

          return;
        }

        prontoDisparado = true;

        let numero = null;

        try {
          numero = novoCliente.info?.wid?.user || null;
        } catch {}

        whatsappPronto = true;

        tentativaReconexao = 0;

        if (timerReconexao) {
          clearTimeout(timerReconexao);

          timerReconexao = null;
        }

        reconexaoAgendada = false;

        atualizarEstado({
          status: "CONECTADO",
          numero,
          qrCode: null,
        });

        console.log("[BOT] WhatsApp pronto!");

        iniciarListenerPedidos();

        await reconciliarPedidosPendentes();

        processarFilaPedidos();
      } catch (erro) {
        console.error("[BOT] Erro durante READY:");

        console.error("message:", erro?.message || String(erro));

        console.error("stack:", erro?.stack || "Stack indisponível");

        whatsappPronto = false;
      }
    });

    /*
     * DISCONNECTED
     */
    novoCliente.on("disconnected", async (reason) => {
      if (client !== novoCliente || sessaoAtual !== idSessaoWhatsapp) {
        console.log("[BOT] Cliente antigo desconectado. Ignorando.");

        return;
      }

      whatsappPronto = false;

      atualizarEstado({
        status: "DESCONECTADO",
        numero: null,
        qrCode: null,
      });

      console.warn("[BOT] WhatsApp desconectado:", reason);

      /*
       * Mantém a referência REAL do cliente que
       * disparou o evento.
       */
      const clienteDesconectado = novoCliente;

      /*
       * Invalida imediatamente os eventos desse cliente.
       */
      client = null;

      idSessaoWhatsapp++;

      clienteParaLimpeza = clienteDesconectado;

      pararListenerPedidos();

      try {
        /*
         * A destruição acontece ANTES de agendar
         * a próxima criação.
         */
        await destruirClienteWhatsapp(clienteDesconectado, "desconexão");
      } finally {
        if (clienteParaLimpeza === clienteDesconectado) {
          clienteParaLimpeza = null;
        }

        if (!botEncerrando) {
          agendarReconexao();
        }
      }
    });

    /*
     * BROWSER CLOSED
     */
    novoCliente.on("browser_closed", () => {
      if (client !== novoCliente || sessaoAtual !== idSessaoWhatsapp) {
        return;
      }

      console.warn("[BOT] Browser do WhatsApp foi fechado.");

      whatsappPronto = false;

      atualizarEstado({
        status: "DESCONECTADO",
        numero: null,
        qrCode: null,
      });

      /*
       * O evento significa que o browser já fechou.
       * Não tentamos destruí-lo novamente.
       */
      client = null;

      idSessaoWhatsapp++;

      pararListenerPedidos();

      if (!botEncerrando) {
        agendarReconexao();
      }
    });

    /*
     * AUTH FAILURE
     */
    novoCliente.on("auth_failure", (msg) => {
      if (client !== novoCliente || sessaoAtual !== idSessaoWhatsapp) {
        return;
      }

      whatsappPronto = false;

      atualizarEstado({
        status: "FALHA_AUTENTICACAO",
        qrCode: null,
      });

      console.error("[BOT] Falha na autenticação:");

      console.error("message:", msg?.message || String(msg));

      console.error("stack:", msg?.stack || "Stack indisponível");

      /*
       * A sessão nunca é apagada.
       */
    });

    /*
     * INITIALIZE
     */
    console.log("[BOT] Chamando initialize do WhatsApp...");

    try {
      await novoCliente.initialize();

      console.log("[BOT] initialize() concluído.");

      resolverInicializacao();
    } catch (erro) {
      console.error("[BOT] ERRO REAL NO initialize():");

      console.error("message:", erro?.message || String(erro));

      console.error("stack:", erro?.stack || "Stack indisponível");

      if (client === novoCliente) {
        client = null;
        whatsappPronto = false;

        atualizarEstado({
          status: "DESCONECTADO",
          qrCode: null,
          numero: null,
        });
      }

      /*
       * Tenta destruir o cliente caso ele tenha
       * conseguido iniciar parcialmente.
       */
      await destruirClienteWhatsapp(novoCliente, "falha no initialize()");

      /*
       * Se o erro foi causado por um Chromium órfão,
       * remove somente o processo que está usando
       * session-mesa-facil.
       */
      if (erro?.message?.includes("The browser is already running")) {
        console.warn(
          "[BOT] Chromium preso detectado. Tentando liberar a sessão...",
        );

        await encerrarChromiumSessao();
      }

      rejeitadorInicializacao(erro);

      throw erro;
    }
  };

  try {
    await executarInicializacao();
  } finally {
    inicializacaoEmAndamento = null;
    inicializandoCliente = false;
  }

  return inicializacaoEmAndamento;
}

/* ==========================================================
   ROTAS API
========================================================== */

/*
 * STATUS
 */

app.get("/api/whatsapp/status", (req, res) => {
  res.json({
    success: true,

    ...whatsappState,

    filaPedidos: filaPedidosPendentes.size,

    whatsappPronto,
  });
});

/*
 * RECONEXÃO MANUAL
 */

app.post("/api/whatsapp/reconnect", async (req, res) => {
  try {
    if (reconectando) {
      return res.json({
        success: true,

        message: "Reconexão já está em andamento.",
      });
    }

    atualizarEstado({
      status: "RECONECTANDO",
      qrCode: null,
      numero: null,
    });

    reconectarWhatsapp({
      manual: true,
    }).catch((erro) => {
      console.error("[BOT] Erro na reconexão manual:");

      console.error("message:", erro?.message || String(erro));

      console.error("stack:", erro?.stack || "Stack indisponível");
    });

    res.json({
      success: true,

      message: "Reconexão iniciada.",
    });
  } catch (erro) {
    console.error("[BOT] Erro ao reconectar:");

    console.error("message:", erro?.message || String(erro));

    console.error("stack:", erro?.stack || "Stack indisponível");

    res.status(500).json({
      success: false,

      message: "Erro ao reconectar WhatsApp.",
    });
  }
});

/*
 * BEE
 */

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

async function iniciarBot() {
  const lockObtido = adquirirLockBot();

  if (!lockObtido) {
    console.error("[BOT] Inicialização cancelada para evitar duas instâncias.");

    process.exitCode = 1;

    return;
  }

  botEncerrando = false;

  // restante da função permanece exatamente igual

  /*
   * Libera o lock em encerramento normal.
   */

  process.on("exit", () => {
    liberarLockBot();
  });

  process.on("SIGINT", async () => {
    console.log("[BOT] Encerrando por SIGINT...");

    await encerrarBot();

    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("[BOT] Encerrando por SIGTERM...");

    await encerrarBot();

    process.exit(0);
  });

  process.on("uncaughtException", (erro) => {
    console.error("[BOT] uncaughtException:", erro);
  });

  process.on("unhandledRejection", (erro) => {
    console.error("[BOT] unhandledRejection:", erro);
  });

  app.listen(PORT, () => {
    console.log(`🚀 API do WhatsApp rodando em http://localhost:${PORT}`);

    console.log(`[BOT] PID: ${process.pid}`);

    console.log("[BOT] Sessão WhatsApp: mesa-facil");

    console.log("[BOT] DataPath: .wwebjs_auth");
  });

  /*
   * IMPORTANTE:
   *
   * O lock já foi adquirido antes de criar o cliente.
   */

  await criarClienteWhatsapp();
}

/* ==========================================================
   ENCERRAR CHROMIUM PRESO DA SESSÃO
========================================================== */

async function encerrarChromiumSessao() {
  const diretorioSessao = path.resolve(
    __dirname,
    ".wwebjs_auth",
    "session-mesa-facil",
  );

  console.warn(
    `[BOT] Verificando Chromium preso na sessão: ${diretorioSessao}`,
  );

  return new Promise((resolve) => {
    const script = `
      $sessionDir = [System.IO.Path]::GetFullPath($env:WHATSAPP_SESSION_DIR).TrimEnd('\\').ToLowerInvariant();

      $processos = Get-CimInstance Win32_Process |
        Where-Object {
          $_.Name -match '^(chrome|chromium)(\\.exe)?$' -and
          $_.CommandLine -and
          $_.CommandLine.ToLowerInvariant().Contains($sessionDir)
        };

      foreach ($processo in $processos) {

        Write-Output ("PID=" + $processo.ProcessId);

        try {

          Stop-Process -Id $processo.ProcessId -Force -ErrorAction Stop;

          Write-Output ("ENCERRADO=" + $processo.ProcessId);

        } catch {

          Write-Output ("ERRO=" + $processo.ProcessId + ":" + $_.Exception.Message);

        }
      }
    `;

    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ],
      {
        windowsHide: true,
        env: {
          ...process.env,
          WHATSAPP_SESSION_DIR: diretorioSessao,
        },
      },
      (erro, stdout, stderr) => {
        if (erro) {
          console.error("[BOT] Erro ao verificar/encerrar Chromium preso:");

          console.error("message:", erro?.message || String(erro));

          console.error("stack:", erro?.stack || "Stack indisponível");

          if (stderr) {
            console.error("[BOT] PowerShell:", stderr.trim());
          }

          resolve(false);

          return;
        }

        const resultado = String(stdout || "").trim();

        if (resultado) {
          console.warn("[BOT] Resultado da verificação do Chromium:");

          console.warn(resultado);
        } else {
          console.log(
            "[BOT] Nenhum Chromium preso encontrado para esta sessão.",
          );
        }

        resolve(true);
      },
    );
  });
}

/* ==========================================================
   ENCERRAMENTO
========================================================== */

async function encerrarBot() {
  /*
   * Impede qualquer reconexão ou criação enquanto
   * o processo está sendo encerrado.
   */
  botEncerrando = true;

  whatsappPronto = false;

  /*
   * Cancela retry automático.
   */
  if (timerReconexao) {
    clearTimeout(timerReconexao);

    timerReconexao = null;
  }

  reconexaoAgendada = false;

  pararListenerPedidos();

  /*
   * Invalida eventos do cliente atual.
   */
  const clienteParaDestruir = client;

  client = null;

  idSessaoWhatsapp++;

  /*
   * Aguarda uma reconexão que já esteja em andamento.
   *
   * Ela não poderá criar outro cliente porque
   * botEncerrando === true.
   */
  if (reconectando) {
    console.log(
      "[BOT] Aguardando reconexão em andamento antes do encerramento...",
    );

    while (reconectando) {
      await aguardar(100);
    }
  }

  /*
   * Aguarda eventual destruição já existente.
   */
  if (destruicaoEmAndamento) {
    console.log("[BOT] Aguardando destruição anterior...");

    await destruicaoEmAndamento;
  }

  /*
   * Destrói o cliente atual, se existir.
   */
  if (clienteParaDestruir) {
    await destruirClienteWhatsapp(clienteParaDestruir, "encerramento do bot");
  }

  /*
   * Garante que nenhum Chromium esteja sendo
   * destruído neste momento.
   */
  if (destruicaoEmAndamento) {
    await destruicaoEmAndamento;
  }

  liberarLockBot();
}

/* ==========================================================
   INICIALIZAÇÃO
========================================================== */

iniciarBot().catch((erro) => {
  console.error("[BOT] Erro fatal ao iniciar:", erro);

  liberarLockBot();

  process.exitCode = 1;
});
