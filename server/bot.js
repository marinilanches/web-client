const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
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

let whatsappPronto = false;

let inicializandoCliente = false;

let reconectando = false;

let reconexaoAgendada = false;

let idSessaoWhatsapp = 0;

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

const arquivoLock = path.join(
  __dirname,
  ".bot-instance.lock"
);

let lockFd = null;

function obterPidDoLock() {
  try {
    const conteudo = fs.readFileSync(
      arquivoLock,
      "utf8"
    );

    const pid = Number(
      String(conteudo).trim()
    );

    return Number.isInteger(pid)
      ? pid
      : null;

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
    lockFd = fs.openSync(
      arquivoLock,
      "wx"
    );

    fs.writeFileSync(
      lockFd,
      String(process.pid),
      "utf8"
    );

    console.log(
      `[BOT] Lock adquirido. PID ${process.pid}.`
    );

    return true;

  } catch (erro) {

    if (erro.code !== "EEXIST") {
      throw erro;
    }

    const pidAnterior =
      obterPidDoLock();

    if (
      pidAnterior &&
      pidAnterior !== process.pid &&
      processoExiste(pidAnterior)
    ) {

      console.error(
        `[BOT] Outra instância do bot já está em execução. PID ${pidAnterior}.`
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
      "[BOT] Lock antigo encontrado sem processo correspondente. Removendo apenas o lock do bot."
    );

    try {
      fs.unlinkSync(arquivoLock);
    } catch (e) {
      console.error(
        "[BOT] Não foi possível remover lock antigo:",
        e.message
      );

      return false;
    }

    return adquirirLockBot();
  }
}

function liberarLockBot() {
  if (lockFd !== null) {
    try {
      fs.closeSync(lockFd);
    } catch { }
    lockFd = null;
  }

  try {
    if (fs.existsSync(arquivoLock)) {
      const pid = obterPidDoLock();

      if (
        !pid ||
        pid === process.pid
      ) {
        fs.unlinkSync(arquivoLock);
      }
    }
  } catch (erro) {
    console.error(
      "[BOT] Erro ao liberar lock:",
      erro.message
    );
  }
}

/* ==========================================================
   FUNÇÕES AUXILIARES
========================================================== */

function atualizarEstado(dados = {}) {
  Object.assign(
    whatsappState,
    dados,
    {
      ultimaAtualizacao:
        new Date().toISOString(),
    }
  );
}

function aguardar(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

function ehErroFrame(e) {
  const mensagem = String(
    e?.message || e
  );

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

  let numero = String(
    telefone
  ).replace(/\D/g, "");

  numero = numero.replace(
    /^0+/,
    ""
  );

  if (numero.length === 9) {
    numero = `19${numero}`;
  }

  if (numero.length === 8) {
    numero = `19${numero}`;
  }

  if (
    numero.length === 10 ||
    numero.length === 11
  ) {
    numero = `55${numero}`;
  }

  if (
    !numero.startsWith("55") &&
    (
      numero.length === 10 ||
      numero.length === 11
    )
  ) {
    numero = `55${numero}`;
  }

  if (
    numero.length < 12 ||
    numero.length > 13
  ) {
    return null;
  }

  return numero;
}

/* ==========================================================
   PEDIDOS
========================================================== */

const URL_PUBLICA =
  "https://marinilanches.vercel.app";

function gerarLinkPedido(pedidoId) {
  return `${URL_PUBLICA}/status.html?id=${pedidoId}`;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
}

function montarMensagemStatus(pedido) {
  const cliente =
    pedido.cliente || "Cliente";

  const numeroPedido =
    pedido.numeroPedido || pedido.id;

  const total =
    formatarMoeda(pedido.valorTotal);

  const linkPedido =
    gerarLinkPedido(pedido.id);

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

function chavePedido(
  pedidoId,
  status
) {
  return `${pedidoId}_${status}`;
}

/* ==========================================================
   ADICIONAR PEDIDO À FILA
========================================================== */

function adicionarPedidoFila(
  pedidoId,
  pedido
) {
  const status = pedido?.status;

  if (!status) {
    return;
  }

  if (
    pedido.ultimoStatusNotificado ===
    status
  ) {
    return;
  }

  const chave =
    chavePedido(
      pedidoId,
      status
    );

  if (
    enviando.has(chave) ||
    enviadosRecentemente.has(chave) ||
    filaPedidosPendentes.has(chave)
  ) {
    return;
  }

  filaPedidosPendentes.set(
    chave,
    {
      pedidoId,
      status,
    }
  );

  console.log(
    `[BOT] Pedido ${pedidoId} status ${status} adicionado à fila.`
  );

  processarFilaPedidos();
}

/* ==========================================================
   PROCESSAR FILA
========================================================== */

function processarFilaPedidos() {

  if (
    !whatsappPronto ||
    reconectando ||
    !client
  ) {
    return;
  }

  filaMensagens =
    filaMensagens
      .catch(() => { })
      .then(
        async () => {

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

            const entrada =
              filaPedidosPendentes
                .entries()
                .next()
                .value;

            if (!entrada) {
              break;
            }

            const [
              chave,
              dados,
            ] = entrada;

            filaPedidosPendentes.delete(
              chave
            );

            const {
              pedidoId,
              status,
            } = dados;

            const chaveEnvio =
              chavePedido(
                pedidoId,
                status
              );

            if (
              enviando.has(
                chaveEnvio
              )
            ) {
              continue;
            }

            if (
              enviadosRecentemente.has(
                chaveEnvio
              )
            ) {
              continue;
            }

            enviando.add(
              chaveEnvio
            );

            try {

              await enviarMensagemPedido(
                pedidoId,
                {
                  id: pedidoId,
                  status,
                }
              );

            } catch (erro) {

              console.error(
                `[BOT] Erro ao processar pedido ${pedidoId}:`,
                erro
              );

              /*
               * Se o WhatsApp caiu durante o envio,
               * recoloca na fila.
               */

              if (
                !whatsappPronto ||
                reconectando
              ) {

                filaPedidosPendentes.set(
                  chaveEnvio,
                  {
                    pedidoId,
                    status,
                  }
                );
              }

            } finally {

              enviando.delete(
                chaveEnvio
              );
            }
          }
        }
      );
}

/* ==========================================================
   ENVIO DE MENSAGEM
========================================================== */

async function enviarMensagemPedido(
  pedidoId,
  referencia
) {

  const clienteAtual =
    client;

  const sessaoEnvio =
    idSessaoWhatsapp;

  if (
    !clienteAtual ||
    !whatsappPronto ||
    reconectando
  ) {

    console.log(
      `[BOT] WhatsApp offline. Pedido ${pedidoId} permanece aguardando.`
    );

    throw new Error(
      "WhatsApp offline."
    );
  }

  /*
   * Consulta novamente o Firestore.
   */

  const doc =
    await db
      .collection("pedidos")
      .doc(pedidoId)
      .get();

  if (!doc.exists) {

    console.log(
      `[BOT] Pedido ${pedidoId} não existe mais.`
    );

    return;
  }

  const pedido =
    doc.data();

  const statusAtual =
    pedido.status;

  /*
   * Se o status mudou desde que entrou na fila,
   * não enviamos o status antigo.
   *
   * O novo status será colocado na fila pelo
   * listener ou pela reconciliação.
   */

  if (
    referencia.status &&
    statusAtual !==
    referencia.status
  ) {

    console.log(
      `[BOT] Pedido ${pedidoId} mudou de ${referencia.status} para ${statusAtual} antes do envio.`
    );

    if (
      statusAtual &&
      pedido.ultimoStatusNotificado !==
      statusAtual
    ) {

      adicionarPedidoFila(
        pedidoId,
        pedido
      );
    }

    return;
  }

  /*
   * Já foi notificado.
   */

  if (
    pedido.ultimoStatusNotificado ===
    statusAtual
  ) {

    console.log(
      `[BOT] Pedido ${pedidoId} já foi notificado para ${statusAtual}.`
    );

    return;
  }

  /*
   * Verifica se ainda é a mesma sessão.
   */

  if (
    sessaoEnvio !==
    idSessaoWhatsapp ||
    client !== clienteAtual
  ) {

    throw new Error(
      "Sessão WhatsApp substituída durante o processamento."
    );
  }

  /*
   * TELEFONE
   */

  const telefoneNormalizado =
    pedido.telefoneWhatsapp ||
    normalizarTelefone(
      pedido.telefone
    );

  if (!telefoneNormalizado) {

    console.log(
      `[BOT] Pedido ${pedidoId} sem telefone válido.`
    );

    return;
  }

  /*
   * MENSAGEM
   */

  const mensagem =
    montarMensagemStatus({
      ...pedido,
      id: pedidoId,
    });

  if (!mensagem) {

    console.log(
      `[BOT] Status ${statusAtual} sem mensagem configurada.`
    );

    return;
  }

  const chatId =
    `${telefoneNormalizado}@c.us`;

  /*
   * ESTADO DO WHATSAPP
   */

  try {

    const estado =
      await clienteAtual.getState();

    console.log(
      `[BOT] Estado antes do envio do pedido ${pedidoId}: ${estado}`
    );

    if (
      estado !== "CONNECTED"
    ) {

      whatsappPronto =
        false;

      throw new Error(
        "WhatsApp não está CONNECTED."
      );
    }

  } catch (erro) {

    if (
      ehErroFrame(erro)
    ) {

      whatsappPronto =
        false;
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
    sessaoEnvio !==
    idSessaoWhatsapp ||
    !whatsappPronto ||
    reconectando
  ) {

    throw new Error(
      "Sessão não está mais disponível."
    );
  }

  console.log(
    `[BOT] Enviando WhatsApp para ${chatId} - pedido ${pedidoId} - status ${statusAtual}`
  );

  /*
   * ENVIO
   */

  try {

    await clienteAtual.sendMessage(
      chatId,
      mensagem,
      {
        sendSeen: false,
      }
    );

  } catch (erro) {

    console.error(
      `[BOT] Erro no envio do pedido ${pedidoId}:`,
      erro
    );

    if (
      ehErroFrame(erro)
    ) {

      whatsappPronto =
        false;
    }

    throw erro;
  }

  console.log(
    `[BOT] WhatsApp aceitou o envio do pedido ${pedidoId}.`
  );

  /*
   * MARCA COMO NOTIFICADO.
   *
   * Tentamos algumas vezes porque a mensagem já foi
   * aceita pelo WhatsApp.
   */

  let atualizado = false;
  let ultimoErro = null;

  for (
    let tentativa = 1;
    tentativa <= 3;
    tentativa++
  ) {

    try {

      await db
        .collection("pedidos")
        .doc(pedidoId)
        .update({
          ultimoStatusNotificado:
            statusAtual,

          notificacaoWhatsappEm:
            FieldValue.serverTimestamp(),
        });

      atualizado = true;

      break;

    } catch (erro) {

      ultimoErro =
        erro;

      console.error(
        `[BOT] Falha ao registrar notificação do pedido ${pedidoId} (tentativa ${tentativa}/3):`,
        erro
      );

      if (
        tentativa < 3
      ) {
        await aguardar(
          1000 * tentativa
        );
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
      ultimoErro
    );

    return;
  }

  /*
   * CONTADORES
   */

  whatsappState.mensagensHoje++;

  const chave =
    chavePedido(
      pedidoId,
      statusAtual
    );

  enviadosRecentemente.add(
    chave
  );

  setTimeout(
    () => {
      enviadosRecentemente.delete(
        chave
      );
    },
    60000
  );

  console.log(
    `[BOT] Mensagem enviada com sucesso - pedido ${pedidoId} - status ${statusAtual}`
  );
}

/* ==========================================================
   RECONCILIAR PEDIDOS
========================================================== */

/*
 * Esta função resolve o principal problema da fila offline.
 *
 * Sempre que o WhatsApp fica READY, consultamos o Firestore
 * e procuramos pedidos cujo:
 *
 * status !== ultimoStatusNotificado
 *
 * Assim, pedidos que mudaram enquanto o WhatsApp estava
 * offline não são perdidos.
 */

async function reconciliarPedidosPendentes() {

  if (
    !whatsappPronto ||
    !client ||
    reconectando
  ) {
    return;
  }

  console.log(
    "[BOT] Verificando pedidos pendentes no Firestore..."
  );

  try {

    const snapshot =
      await db
        .collection("pedidos")
        .get();

    let encontrados = 0;

    for (
      const doc of snapshot.docs
    ) {

      const pedido =
        doc.data();

      if (!pedido.status) {
        continue;
      }

      if (
        pedido.ultimoStatusNotificado ===
        pedido.status
      ) {
        continue;
      }

      /*
       * Só adicionamos estados que possuem mensagem.
       */

      const mensagem =
        montarMensagemStatus({
          ...pedido,
          id: doc.id,
        });

      if (!mensagem) {
        continue;
      }

      encontrados++;

      adicionarPedidoFila(
        doc.id,
        pedido
      );
    }

    console.log(
      `[BOT] Reconciliação concluída. ${encontrados} pedido(s) pendente(s) encontrado(s).`
    );

    processarFilaPedidos();

  } catch (erro) {

    console.error(
      "[BOT] Erro ao reconciliar pedidos:",
      erro
    );
  }
}

/* ==========================================================
   LISTENER DOS PEDIDOS
========================================================== */

function iniciarListenerPedidos() {

  if (
    pedidosListenerIniciado
  ) {

    console.log(
      "[BOT] Listener de pedidos já está iniciado."
    );

    return;
  }

  pedidosListenerIniciado =
    true;

  let listenerInicializado =
    false;

  const statusConhecidos =
    new Map();

  unsubscribePedidos =
    db
      .collection("pedidos")
      .onSnapshot(

        (snapshot) => {

          /*
           * PRIMEIRA LEITURA
           *
           * Não enviamos tudo automaticamente aqui.
           *
           * A reconciliação do READY cuida dos pedidos
           * pendentes.
           */

          if (
            !listenerInicializado
          ) {

            for (
              const doc of snapshot.docs
            ) {

              const pedido =
                doc.data();

              statusConhecidos.set(
                doc.id,
                pedido.status || null
              );
            }

            listenerInicializado =
              true;

            console.log(
              `[BOT] Listener inicializado. ${snapshot.size} pedidos carregados.`
            );

            return;
          }

          /*
           * ALTERAÇÕES
           */

          for (
            const change of
            snapshot.docChanges()
          ) {

            const pedidoId =
              change.doc.id;

            /*
             * REMOVIDO
             */

            if (
              change.type ===
              "removed"
            ) {

              statusConhecidos.delete(
                pedidoId
              );

              /*
               * Remove possíveis entradas antigas
               * desse pedido da fila.
               */

              for (
                const [
                  chave,
                  dados,
                ] of filaPedidosPendentes
              ) {

                if (
                  dados.pedidoId ===
                  pedidoId
                ) {

                  filaPedidosPendentes.delete(
                    chave
                  );
                }
              }

              continue;
            }

            const pedido =
              change.doc.data();

            const statusAtual =
              pedido.status || null;

            const statusAnterior =
              statusConhecidos.get(
                pedidoId
              ) || null;

            statusConhecidos.set(
              pedidoId,
              statusAtual
            );

            if (!statusAtual) {
              continue;
            }

            /*
             * ADDED
             *
             * Um pedido criado depois que o listener
             * já está funcionando deve ser processado.
             */

            if (
              change.type ===
              "added"
            ) {

              if (
                pedido.ultimoStatusNotificado !==
                statusAtual
              ) {

                adicionarPedidoFila(
                  pedidoId,
                  pedido
                );
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

            if (
              change.type ===
              "modified" &&
              statusAtual ===
              statusAnterior
            ) {

              continue;
            }

            /*
             * Status mudou.
             */

            if (
              pedido.ultimoStatusNotificado !==
              statusAtual
            ) {

              adicionarPedidoFila(
                pedidoId,
                pedido
              );
            }
          }

          processarFilaPedidos();
        },

        (erro) => {

          console.error(
            "[BOT] Erro ao ouvir pedidos:",
            erro
          );

          /*
           * Permite tentar iniciar novamente caso o
           * listener seja perdido.
           */

          pedidosListenerIniciado =
            false;

          unsubscribePedidos =
            null;
        }
      );

  console.log(
    "[BOT] Listener de pedidos iniciado."
  );
}

/* ==========================================================
   PARAR LISTENER
========================================================== */

function pararListenerPedidos() {

  if (
    unsubscribePedidos
  ) {

    try {
      unsubscribePedidos();
    } catch { }
  }

  unsubscribePedidos =
    null;

  pedidosListenerIniciado =
    false;
}

/* ==========================================================
   LIMPAR FILA
========================================================== */

function limparFilaWhatsapp() {

  filaMensagens =
    Promise.resolve();

  enviando.clear();

  /*
   * NÃO apagamos filaPedidosPendentes aqui.
   *
   * Os pedidos precisam continuar aguardando.
   */
}

/* ==========================================================
   RECONEXÃO
========================================================== */

async function reconectarWhatsapp() {

  if (
    reconectando
  ) {

    console.log(
      "[BOT] Reconexão já está em andamento."
    );

    return;
  }

  reconectando =
    true;

  whatsappPronto =
    false;

  atualizarEstado({
    status: "RECONECTANDO",
    qrCode: null,
    numero: null,
  });

  pararListenerPedidos();

  const clienteParaDestruir =
    client;

  client =
    null;

  idSessaoWhatsapp++;

  try {

    console.log(
      "[BOT] Iniciando limpeza para reconexão..."
    );

    limparFilaWhatsapp();

    if (
      clienteParaDestruir
    ) {

      console.log(
        "[BOT] Destruindo cliente WhatsApp antigo..."
      );

      try {

        await clienteParaDestruir.destroy();

        console.log(
          "[BOT] Cliente antigo destruído."
        );

      } catch (erro) {

        console.warn(
          "[BOT] Erro ao destruir cliente antigo:",
          erro.message
        );
      }
    }

    /*
     * Tempo para Chromium/Chrome encerrar.
     */

    await aguardar(3000);

    /*
     * Se ainda existir algum browser associado,
     * o whatsapp-web.js tratará a inicialização.
     */

    console.log(
      "[BOT] Criando novo cliente WhatsApp..."
    );

    await criarClienteWhatsapp();

  } catch (erro) {

    console.error(
      "[BOT] Erro durante reconexão:",
      erro
    );

  } finally {

    reconectando =
      false;
  }
}

/* ==========================================================
   AGENDAR RECONEXÃO
========================================================== */

function agendarReconexao() {

  if (reconexaoAgendada) {
    return;
  }

  reconexaoAgendada = true;

  setTimeout(
    async () => {

      reconexaoAgendada = false;

      if (
        whatsappPronto ||
        reconectando
      ) {
        return;
      }

      console.log(
        "[BOT] Tentando reconectar WhatsApp..."
      );

      try {

        await reconectarWhatsapp();

      } catch (erro) {

        console.error(
          "[BOT] Falha na tentativa de reconexão:",
          erro
        );

        agendarReconexao();
      }

    },
    15000
  );
}

/* ==========================================================
   CRIAR CLIENTE WHATSAPP
========================================================== */

async function criarClienteWhatsapp() {

  if (
    inicializandoCliente
  ) {

    console.log(
      "[BOT] Cliente já está sendo inicializado."
    );

    return;
  }

  if (
    client &&
    !reconectando
  ) {

    console.log(
      "[BOT] Cliente WhatsApp já existe. Nova criação ignorada."
    );

    return;
  }

  inicializandoCliente =
    true;

  const sessaoAtual =
    ++idSessaoWhatsapp;

  const novoCliente =
    new Client({

      authStrategy:
        new LocalAuth({
          clientId:
            "mesa-facil",
        }),

      puppeteer: {
        headless: true,

        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      },
    });

  client =
    novoCliente;

  let prontoDisparado =
    false;

  let autenticado =
    false;

  /*
   * QR
   */

  novoCliente.on(
    "qr",
    async (qr) => {

      if (
        client !== novoCliente
      ) {
        return;
      }

      try {

        const qrBase64 =
          await QRCode.toDataURL(
            qr
          );

        atualizarEstado({
          status:
            "AGUARDANDO_QR",
          qrCode:
            qrBase64,
          numero:
            null,
        });

        console.log(
          "[BOT] QR Code gerado."
        );

      } catch (erro) {

        console.error(
          "[BOT] Erro ao gerar QR:",
          erro
        );
      }
    }
  );

  /*
   * AUTHENTICATED
   */

  novoCliente.on(
    "authenticated",
    () => {

      if (
        client !== novoCliente
      ) {
        return;
      }

      if (
        autenticado
      ) {

        console.log(
          "[BOT] Autenticação duplicada ignorada."
        );

        return;
      }

      autenticado =
        true;

      atualizarEstado({
        status:
          "AUTENTICADO",
      });

      console.log(
        "[BOT] WhatsApp autenticado."
      );
    }
  );

  /*
   * LOADING
   */

  novoCliente.on(
    "loading_screen",
    (
      percent,
      message
    ) => {

      if (
        client !== novoCliente
      ) {
        return;
      }

      console.log(
        `[BOT] Carregando WhatsApp ${percent}% - ${message}`
      );
    }
  );

  /*
   * CHANGE STATE
   */

  novoCliente.on(
    "change_state",
    (state) => {

      if (
        client !== novoCliente
      ) {
        return;
      }

      console.log(
        "[BOT] Estado WhatsApp:",
        state
      );

      if (
        state !==
        "CONNECTED"
      ) {

        whatsappPronto =
          false;

        atualizarEstado({
          status:
            "DESCONECTADO",
        });
      }
    }
  );

  /*
   * READY
   */

  novoCliente.on(
    "ready",
    async () => {

      if (
        client !== novoCliente
      ) {

        console.log(
          "[BOT] READY de cliente antigo ignorado."
        );

        return;
      }

      if (
        prontoDisparado
      ) {

        console.log(
          "[BOT] READY duplicado ignorado."
        );

        return;
      }

      try {

        /*
         * Aguarda estabilização.
         */

        await aguardar(3000);

        if (
          client !== novoCliente ||
          sessaoAtual !==
          idSessaoWhatsapp
        ) {

          return;
        }

        const estado =
          await novoCliente.getState();

        console.log(
          "[BOT] Estado após estabilização:",
          estado
        );

        if (
          estado !==
          "CONNECTED"
        ) {

          whatsappPronto =
            false;

          return;
        }

        prontoDisparado =
          true;

        let numero =
          null;

        try {

          numero =
            novoCliente
              .info
              ?.wid
              ?.user ||
            null;

        } catch { }

        whatsappPronto =
          true;

        atualizarEstado({
          status:
            "CONECTADO",

          numero,

          qrCode:
            null,
        });

        console.log(
          "[BOT] WhatsApp pronto!"
        );

        /*
         * Inicia o listener.
         */

        iniciarListenerPedidos();

        /*
         * IMPORTANTE:
         *
         * Recupera pedidos que ficaram pendentes
         * enquanto o WhatsApp estava offline.
         */

        await reconciliarPedidosPendentes();

        processarFilaPedidos();

      } catch (erro) {

        console.error(
          "[BOT] Erro durante READY:",
          erro
        );

        whatsappPronto =
          false;
      }
    }
  );

  /*
   * DISCONNECTED
   */

  novoCliente.on(
    "disconnected",
    async (reason) => {

      /*
       * Cliente antigo.
       */

      if (
        client !==
        novoCliente
      ) {

        console.log(
          "[BOT] Cliente antigo desconectado. Ignorando."
        );

        return;
      }

      whatsappPronto =
        false;

      atualizarEstado({
        status:
          "DESCONECTADO",

        numero:
          null,

        qrCode:
          null,
      });

      console.warn(
        "[BOT] WhatsApp desconectado:",
        reason
      );

      /*
       * Não destruímos novamente o cliente aqui.
       *
       * O evento disconnected já ocorreu.
       *
       * Apenas invalidamos a sessão atual.
       */

      client =
        null;

      idSessaoWhatsapp++;

      pararListenerPedidos();

      agendarReconexao();
    }
  );

  /*
   * BROWSER CLOSED
   */

  novoCliente.on(
    "browser_closed",
    () => {

      if (
        client !== novoCliente
      ) {
        return;
      }

      console.warn(
        "[BOT] Browser do WhatsApp foi fechado."
      );

      whatsappPronto = false;

      atualizarEstado({
        status: "DESCONECTADO",
        numero: null,
        qrCode: null,
      });

      client = null;

      idSessaoWhatsapp++;

      pararListenerPedidos();

      agendarReconexao();
    }
  );

  /*
   * AUTH FAILURE
   */

  novoCliente.on(
    "auth_failure",
    (msg) => {

      if (
        client !== novoCliente
      ) {
        return;
      }

      whatsappPronto =
        false;

      atualizarEstado({
        status:
          "FALHA_AUTENTICACAO",

        qrCode:
          null,
      });

      console.error(
        "[BOT] Falha na autenticação:",
        msg
      );

      /*
       * NÃO apagamos .wwebjs_auth.
       *
       * O operador poderá decidir o que fazer
       * caso a sessão realmente tenha sido invalidada.
       */
    }
  );

  /*
   * INITIALIZE
   */

  try {

    console.log(
      "[BOT] Chamando initialize do WhatsApp..."
    );

    await novoCliente.initialize();

  } catch (erro) {

    console.error(
      "[BOT] Erro ao inicializar:",
      erro.message
    );

    if (client === novoCliente) {
      client = null;
      whatsappPronto = false;

      atualizarEstado({
        status: "DESCONECTADO",
        qrCode: null,
        numero: null,
      });
    }

    try {

      console.log(
        "[BOT] Destruindo cliente que falhou na inicialização..."
      );

      await novoCliente.destroy();

      console.log(
        "[BOT] Cliente com falha destruído."
      );

    } catch (erroDestroy) {

      console.warn(
        "[BOT] Não foi possível destruir cliente com falha:",
        erroDestroy.message
      );
    }

    await aguardar(3000);

    agendarReconexao();
  } finally {

    inicializandoCliente =
      false;
  }
}

/* ==========================================================
   ROTAS API
========================================================== */

/*
 * STATUS
 */

app.get(
  "/api/whatsapp/status",
  (req, res) => {

    res.json({
      success: true,

      ...whatsappState,

      filaPedidos:
        filaPedidosPendentes.size,

      whatsappPronto,
    });
  }
);

/*
 * RECONEXÃO MANUAL
 */

app.post(
  "/api/whatsapp/reconnect",
  async (req, res) => {

    try {

      if (
        reconectando
      ) {

        return res.json({
          success: true,

          message:
            "Reconexão já está em andamento.",
        });
      }

      atualizarEstado({
        status:
          "RECONECTANDO",

        qrCode:
          null,

        numero:
          null,
      });

      reconectarWhatsapp();

      res.json({
        success: true,

        message:
          "Reconexão iniciada.",
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

/*
 * BEE
 */

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

async function iniciarBot() {

  /*
   * Primeiro garante uma única instância.
   */

  const lockObtido =
    adquirirLockBot();

  if (!lockObtido) {

    console.error(
      "[BOT] Inicialização cancelada para evitar duas instâncias."
    );

    process.exitCode = 1;

    return;
  }

  /*
   * Libera o lock em encerramento normal.
   */

  process.on(
    "exit",
    () => {
      liberarLockBot();
    }
  );

  process.on(
    "SIGINT",
    async () => {

      console.log(
        "[BOT] Encerrando por SIGINT..."
      );

      await encerrarBot();

      process.exit(0);
    }
  );

  process.on(
    "SIGTERM",
    async () => {

      console.log(
        "[BOT] Encerrando por SIGTERM..."
      );

      await encerrarBot();

      process.exit(0);
    }
  );

  process.on(
    "uncaughtException",
    (erro) => {

      console.error(
        "[BOT] uncaughtException:",
        erro
      );
    }
  );

  process.on(
    "unhandledRejection",
    (erro) => {

      console.error(
        "[BOT] unhandledRejection:",
        erro
      );
    }
  );

  app.listen(
    PORT,
    () => {

      console.log(
        `🚀 API do WhatsApp rodando em http://localhost:${PORT}`
      );

      console.log(
        `[BOT] PID: ${process.pid}`
      );

      console.log(
        "[BOT] Sessão WhatsApp: mesa-facil"
      );

      console.log(
        "[BOT] DataPath: .wwebjs_auth"
      );
    }
  );

  /*
   * IMPORTANTE:
   *
   * O lock já foi adquirido antes de criar o cliente.
   */

  await criarClienteWhatsapp();
}

/* ==========================================================
   ENCERRAMENTO
========================================================== */

async function encerrarBot() {

  whatsappPronto =
    false;

  pararListenerPedidos();

  const clienteParaDestruir =
    client;

  client =
    null;

  idSessaoWhatsapp++;

  if (
    clienteParaDestruir
  ) {

    try {

      console.log(
        "[BOT] Destruindo cliente WhatsApp..."
      );

      await clienteParaDestruir.destroy();

      console.log(
        "[BOT] Cliente WhatsApp encerrado."
      );

    } catch (erro) {

      console.warn(
        "[BOT] Erro ao destruir cliente:",
        erro.message
      );
    }
  }

  liberarLockBot();
}

/* ==========================================================
   INICIALIZAÇÃO
========================================================== */

iniciarBot().catch(
  (erro) => {

    console.error(
      "[BOT] Erro fatal ao iniciar:",
      erro
    );

    liberarLockBot();

    process.exitCode = 1;
  }
);