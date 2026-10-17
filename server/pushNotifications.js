const { getMessaging } = require("firebase-admin/messaging");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");

/* ==========================================================
   CONFIGURAÇÃO
========================================================== */

const ADMIN_TOKENS_COLLECTION = "adminNotificationTokens";
const CLIENT_TOKENS_COLLECTION = "clienteNotificationTokens";
const PEDIDOS_COLLECTION = "pedidos";
const SOLICITACOES_COLLECTION = "solicitacoes";

const URL_PEDIDOS_ADMIN = "/admin/pedidos.html";
const URL_STATUS_CLIENTE = "/status.html";

const STATUS_PROPOSTA = "AGUARDANDO_CLIENTE";
const STATUS_ACEITA = "ACEITA";
const STATUS_RECUSADA = "RECUSADA";
const STATUS_ACEITA_TIMEOUT = "ACEITA_TIMEOUT";

/* ==========================================================
   CONTROLE
========================================================== */

let listenerIniciado = false;
let solicitacoesListenerIniciado = false;
let timerSolicitacoes = null;
let timerVendas = null;
let timerPushPendentes = null;
let timerConfirmacoesRecebimento = null;

let timerLembretesRecebimento = null;

const TEMPO_LEMBRETE_RECEBIMENTO_MS = 1 * 1000;
const INTERVALO_LEMBRETES_RECEBIMENTO_MS = 1 * 1000;
const TEMPO_RECUPERACAO_LEMBRETE_MS = 2 * 60 * 1000;

const CAMPO_STATUS_LEMBRETE = "lembreteRecebimentoStatus";
const CAMPO_PRAZO_LEMBRETE = "lembreteRecebimentoEnviarEm";
const CAMPO_STATUS_ESPERADO_LEMBRETE = "lembreteRecebimentoStatusEsperado";
const CAMPO_PROCESSAMENTO_LEMBRETE = "lembreteRecebimentoProcessandoEm";

/* ==========================================================
   HELPERS
========================================================== */

function paraTimestamp(valor) {
  if (!valor) return null;
  if (valor instanceof Timestamp) return valor;
  if (typeof valor.toDate === "function")
    return Timestamp.fromDate(valor.toDate());

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return Timestamp.fromDate(data);
}

function agoraTimestamp() {
  return Timestamp.now();
}

function obterDataTimestamp(valor) {
  const timestamp = paraTimestamp(valor);
  return timestamp ? timestamp.toDate() : null;
}

function adicionarMinutos(timestamp, minutos) {
  const base = obterDataTimestamp(timestamp) || new Date();
  return Timestamp.fromDate(
    new Date(base.getTime() + Number(minutos || 0) * 60 * 1000),
  );
}

function formatarHorario(timestamp) {
  const data = obterDataTimestamp(timestamp);
  if (!data) return "—";

  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function obterUrlStatus(pedidoId) {
  return `${URL_STATUS_CLIENTE}?id=${encodeURIComponent(pedidoId)}`;
}

/* ==========================================================
   TOKENS
========================================================== */

async function removerTokensInvalidos(db, collectionName, tokens, responses) {
  for (let i = 0; i < responses.length; i++) {
    const response = responses[i];
    if (response.success) continue;

    const codigo = response.error?.code || "";
    const tokenInvalido =
      codigo === "messaging/registration-token-not-registered" ||
      codigo === "messaging/invalid-registration-token";

    if (!tokenInvalido) continue;

    const token = tokens[i];

    try {
      const snapshot = await db
        .collection(collectionName)
        .where("token", "==", token)
        .get();

      const batch = db.batch();
      snapshot.forEach((documento) => batch.delete(documento.ref));
      await batch.commit();
    } catch (erro) {
      console.error(
        `[FCM] Erro ao remover token inválido de ${collectionName}:`,
        erro,
      );
    }
  }
}

async function obterTokensAtivos(db, collectionName, filtro = {}) {
  let query = db.collection(collectionName).where("ativo", "==", true);

  if (filtro.uid) {
    query = query.where("uid", "==", filtro.uid);
  }

  if (filtro.clienteId) {
    query = query.where("clienteId", "==", filtro.clienteId);
  }

  const snapshot = await query.get();
  const tokens = [];

  snapshot.forEach((documento) => {
    const dados = documento.data();

    if (typeof dados.token === "string" && dados.token) {
      tokens.push(dados.token);
    }
  });

  return tokens;
}

async function enviarMulticast(db, collectionName, tokens, messageBase) {
  const resultadoTotal = {
    successCount: 0,
    failureCount: 0,
  };

  if (!tokens.length) return resultadoTotal;

  const messaging = getMessaging();

  for (let i = 0; i < tokens.length; i += 500) {
    const grupo = tokens.slice(i, i + 500);

    const resposta = await messaging.sendEachForMulticast({
      ...messageBase,
      tokens: grupo,
    });

    resultadoTotal.successCount += resposta.successCount;
    resultadoTotal.failureCount += resposta.failureCount;

    console.log(
      `[FCM] ${resposta.successCount} notificação(ões) enviada(s). ${resposta.failureCount} falha(s).`,
    );

    await removerTokensInvalidos(db, collectionName, grupo, resposta.responses);
  }

  return resultadoTotal;
}

/* ==========================================================
   NOTIFICAÇÃO ADMIN - NOVO PEDIDO
========================================================== */

async function enviarNotificacaoNovoPedido(db, pedido) {
  try {
    const tokens = await obterTokensAtivos(db, ADMIN_TOKENS_COLLECTION);

    if (!tokens.length) {
      console.log("[FCM] Nenhum navegador admin cadastrado para notificações.");
      return;
    }

    const numero = String(pedido.numeroPedido || "----");
    const pedidoId = String(pedido.id || "");
    const title = "🔔 Novo pedido recebido";
    const body = `Pedido #${numero} recebido.`;

    await enviarMulticast(db, ADMIN_TOKENS_COLLECTION, tokens, {
      notification: { title, body },
      data: {
        numeroPedido: numero,
        pedidoId,
        status: String(pedido.status || "RECEBIDO"),
        url: URL_PEDIDOS_ADMIN,
        title,
        body,
      },
      webpush: {
        fcmOptions: { link: URL_PEDIDOS_ADMIN },
        notification: {
          icon: "/assets/admin-icon.png",
          badge: "/assets/admin-icon.png",
          tag: `pedido-${pedidoId}`,
        },
      },
    });
  } catch (erro) {
    console.error("[FCM] Erro ao enviar notificação de novo pedido:", erro);
  }
}

/* ==========================================================
   NOTIFICAÇÃO ADMIN - SOLICITAÇÃO DO CLIENTE
========================================================== */

async function enviarNotificacaoSolicitacaoAdmin(db, pedido, solicitacao) {
  try {
    const tokens = await obterTokensAtivos(db, ADMIN_TOKENS_COLLECTION);
    if (!tokens.length) return;

    const titulo =
      solicitacao.tipo === "CANCELAMENTO"
        ? "❌ Cliente solicitou cancelamento"
        : solicitacao.tipo === "ATRASO"
          ? "⚠️ Cliente informou atraso"
          : "🕐 Cliente solicitou nova previsão";

    const corpo = `Pedido #${pedido.numeroPedido || pedido.id}: ${solicitacao.mensagem || "Nova solicitação."}`;

    await enviarMulticast(db, ADMIN_TOKENS_COLLECTION, tokens, {
      notification: {
        title: titulo,
        body: corpo,
      },
      data: {
        pedidoId: pedido.id,
        numeroPedido: String(pedido.numeroPedido || ""),
        url: URL_PEDIDOS_ADMIN,
        title: titulo,
        body: corpo,
      },
      webpush: {
        fcmOptions: { link: URL_PEDIDOS_ADMIN },
        notification: {
          icon: "/assets/admin-icon.png",
          badge: "/assets/admin-icon.png",
          tag: `solicitacao-${solicitacao.id}`,
        },
      },
    });
  } catch (erro) {
    console.error("[FCM] Erro ao notificar solicitação ao admin:", erro);
  }
}

/* ==========================================================
   NOTIFICAÇÃO CLIENTE
========================================================== */

async function enviarNotificacaoCliente(db, clienteId, pedido, titulo, corpo) {
  try {
    if (!clienteId || !pedido?.id) {
      console.warn("[FCM] Cliente ou ID do pedido ausente.");
      return { successCount: 0, failureCount: 0 };
    }

    const tokens = await obterTokensAtivos(db, CLIENT_TOKENS_COLLECTION, {
      clienteId,
    });

    if (!tokens.length) {
      console.warn(
        `[FCM] Nenhum token ativo para o cliente do pedido ${pedido.numeroPedido || pedido.id}.`,
      );
      return { successCount: 0, failureCount: 0 };
    }

    const url = obterUrlStatus(pedido.id);

    const resultado = await enviarMulticast(
      db,
      CLIENT_TOKENS_COLLECTION,
      tokens,
      {
        notification: {
          title: titulo,
          body: corpo,
        },
        data: {
          pedidoId: String(pedido.id),
          numeroPedido: String(pedido.numeroPedido || ""),
          status: String(pedido.status || ""),
          url,
          origem: "CLIENTE",
          title: titulo,
          body: corpo,
        },
        webpush: {
          notification: {
            icon: "/assets/avatar.png",
            badge: "/assets/avatar.png",
            tag: `pedido-cliente-${pedido.id}`,
          },
        },
      },
    );

    console.log(
      `[FCM] Pedido ${pedido.numeroPedido || pedido.id}: ${resultado.successCount} envio(s) concluído(s), ${resultado.failureCount} falha(s).`,
    );

    return resultado;
  } catch (erro) {
    console.error("[FCM] Erro ao notificar cliente:", erro);
    return { successCount: 0, failureCount: 0 };
  }
}

/* ==========================================================
   VENDAS DOS PRODUTOS - FIREBASE ADMIN
========================================================== */

async function contabilizarVendasPedido(db, pedido) {
  if (!pedido?.id || pedido.vendasContabilizadas) return;

  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  const quantidades = new Map();

  for (const item of itens) {
    const produtoId = item?.produtoId;
    const quantidade = Number(item?.quantidade || 0);

    if (!produtoId || !Number.isFinite(quantidade) || quantidade <= 0) continue;

    quantidades.set(produtoId, (quantidades.get(produtoId) || 0) + quantidade);
  }

  const pedidoRef = db.collection(PEDIDOS_COLLECTION).doc(pedido.id);

  await db.runTransaction(async (transaction) => {
    const pedidoSnap = await transaction.get(pedidoRef);

    if (!pedidoSnap.exists) return;

    const pedidoAtual = pedidoSnap.data() || {};
    if (pedidoAtual.vendasContabilizadas) return;

    const produtos = [];

    for (const [produtoId, quantidade] of quantidades.entries()) {
      const produtoRef = db.collection("produtos").doc(produtoId);
      const produtoSnap = await transaction.get(produtoRef);

      if (!produtoSnap.exists) {
        console.warn(
          `[VENDAS] Produto ${produtoId} não encontrado no pedido ${pedido.id}.`,
        );
        continue;
      }

      produtos.push({ produtoRef, quantidade });
    }

    for (const produto of produtos) {
      transaction.update(produto.produtoRef, {
        vendas: FieldValue.increment(produto.quantidade),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.update(pedidoRef, {
      vendasContabilizadas: true,
      vendasContabilizadasEm: FieldValue.serverTimestamp(),
    });
  });

  console.log(
    `[VENDAS] Vendas contabilizadas para pedido ${pedido.numeroPedido || pedido.id}.`,
  );
}

/* ==========================================================
   REPROCESSAR VENDAS PENDENTES
========================================================== */

async function processarVendasPendentes(db) {
  try {
    const snapshot = await db
      .collection(PEDIDOS_COLLECTION)
      .where("vendasContabilizadas", "==", false)
      .limit(100)
      .get();

    for (const documento of snapshot.docs) {
      const pedido = {
        id: documento.id,
        ...documento.data(),
      };

      await contabilizarVendasPedido(db, pedido).catch((erro) =>
        console.error(`[VENDAS] Erro ao processar pedido ${pedido.id}:`, erro),
      );
    }
  } catch (erro) {
    console.error("[VENDAS] Erro ao buscar vendas pendentes:", erro);
  }
}

/* ==========================================================
   SOLICITAÇÕES
========================================================== */

function obterPedidoDaSolicitacao(solicitacaoRef) {
  return solicitacaoRef?.parent?.parent || null;
}

async function atualizarContadorSolicitacoes(db, pedidoRef) {
  if (!pedidoRef) return;

  try {
    const snapshot = await pedidoRef.collection(SOLICITACOES_COLLECTION).get();
    const pendentes = snapshot.docs.filter((doc) => {
      const status = doc.data()?.status;
      return status === "PENDENTE" || status === STATUS_PROPOSTA;
    }).length;

    const pedidoSnap = await pedidoRef.get();

    if (!pedidoSnap.exists) {
      console.warn(
        `[SOLICITAÇÕES] Pedido ${pedidoRef.id} não existe mais. Solicitação órfã ignorada.`,
      );
      return;
    }

    await pedidoRef.update({
      solicitacoesPendentesCount: pendentes,
      atualizadoEm: FieldValue.serverTimestamp(),
    });
  } catch (erro) {
    console.error("[SOLICITAÇÕES] Erro ao atualizar contador:", erro);
  }
}

async function processarNovaProposta(db, solicitacaoRef) {
  const pedidoRef = obterPedidoDaSolicitacao(solicitacaoRef);
  if (!pedidoRef) return;

  await db
    .runTransaction(async (transaction) => {
      const [solicitacaoSnap, pedidoSnap] = await Promise.all([
        transaction.get(solicitacaoRef),
        transaction.get(pedidoRef),
      ]);

      if (!solicitacaoSnap.exists || !pedidoSnap.exists) return;

      const solicitacao = solicitacaoSnap.data() || {};
      const pedido = pedidoSnap.data() || {};

      if (
        solicitacao.status !== STATUS_PROPOSTA ||
        solicitacao.origem !== "ADMIN" ||
        solicitacao.enviadaEm
      ) {
        return;
      }

      const agora = agoraTimestamp();
      const minutos = Math.max(
        1,
        Math.min(24 * 60, Number(solicitacao.tempoAdicionalMinutos || 0)),
      );

      const horarioProposto = adicionarMinutos(agora, minutos);
      const aceitaAte = adicionarMinutos(agora, 5);
      const prazoFinal = adicionarMinutos(horarioProposto, 5);

      const previsaoEntrega = {
        horario: horarioProposto,
        enviadaEm: agora,
        aceitaAte,
        prazoFinal,
        resposta: null,
        tempoAdicionalMinutos: minutos,
        motivo: solicitacao.motivo || "",
        solicitacaoId: solicitacaoRef.id,
      };

      transaction.update(solicitacaoRef, {
        origem: "SERVIDOR",
        enviadaEm: agora,
        aceitaAte,
        horarioProposto,
        prazoFinal,
        respostaCliente: null,
      });

      transaction.update(pedidoRef, {
        previsaoEntrega,
        atualizadoEm: agora,
      });

      return {
        clienteId: pedido.clienteId,
        pedido: { id: pedidoRef.id, ...pedido },
        horarioProposto,
        aceitaAte,
        minutos,
      };
    })
    .then(async (resultado) => {
      if (!resultado?.clienteId) return;

      const horario = formatarHorario(resultado.horarioProposto);
      const limite = formatarHorario(resultado.aceitaAte);

      await enviarNotificacaoCliente(
        db,
        resultado.clienteId,
        resultado.pedido,
        "🕐 Nova previsão de entrega",
        `Sua nova previsão é ${horario}. Responda até ${limite}.`,
      );
    });

  await atualizarContadorSolicitacoes(db, pedidoRef);
}

async function processarRespostaCliente(db, solicitacaoRef) {
  const pedidoRef = obterPedidoDaSolicitacao(solicitacaoRef);
  if (!pedidoRef) return;

  let resultado = null;

  await db.runTransaction(async (transaction) => {
    const [solicitacaoSnap, pedidoSnap] = await Promise.all([
      transaction.get(solicitacaoRef),
      transaction.get(pedidoRef),
    ]);

    if (!solicitacaoSnap.exists || !pedidoSnap.exists) return;

    const solicitacao = solicitacaoSnap.data() || {};
    const pedido = pedidoSnap.data() || {};

    if (
      solicitacao.status !== STATUS_PROPOSTA ||
      !["ACEITA", "RECUSADA"].includes(solicitacao.respostaCliente)
    ) {
      return;
    }

    const resposta = solicitacao.respostaCliente;
    const agora = agoraTimestamp();

    if (resposta === "ACEITA") {
      transaction.update(solicitacaoRef, {
        status: STATUS_ACEITA,
        respondidaEm: solicitacao.respondidaEm || agora,
      });
    } else {
      transaction.update(solicitacaoRef, {
        status: STATUS_RECUSADA,
        respondidaEm: solicitacao.respondidaEm || agora,
      });
    }

    if (pedido.previsaoEntrega) {
      transaction.update(pedidoRef, {
        "previsaoEntrega.resposta": resposta,
        "previsaoEntrega.respondidaEm": solicitacao.respondidaEm || agora,
        atualizadoEm: agora,
      });
    }

    resultado = {
      clienteId: pedido.clienteId,
      pedido: { id: pedidoRef.id, ...pedido },
      resposta,
      prazoFinal: pedido.previsaoEntrega?.prazoFinal || null,
    };
  });

  if (resultado?.clienteId) {
    const corpo =
      resultado.resposta === "ACEITA"
        ? `Sua nova previsão foi aceita. Envie o pedido até ${formatarHorario(resultado.prazoFinal)}.`
        : "A nova previsão foi recusada. A loja recebeu sua resposta.";

    await enviarNotificacaoCliente(
      db,
      resultado.clienteId,
      resultado.pedido,
      resultado.resposta === "ACEITA"
        ? "✅ Nova previsão aceita"
        : "❌ Nova previsão recusada",
      corpo,
    );
  }

  await atualizarContadorSolicitacoes(db, pedidoRef);
}

async function processarRespostaCancelamento(db, solicitacaoRef) {
  const pedidoRef = obterPedidoDaSolicitacao(solicitacaoRef);
  if (!pedidoRef) return;

  let resultado = null;

  await db.runTransaction(async (transaction) => {
    const [solicitacaoSnap, pedidoSnap] = await Promise.all([
      transaction.get(solicitacaoRef),
      transaction.get(pedidoRef),
    ]);

    if (!solicitacaoSnap.exists || !pedidoSnap.exists) return;

    const solicitacao = solicitacaoSnap.data() || {};
    const pedido = pedidoSnap.data() || {};

    if (
      solicitacao.tipo !== "CANCELAMENTO" ||
      solicitacao.origem !== "ADMIN" ||
      ![STATUS_ACEITA, STATUS_RECUSADA].includes(solicitacao.status)
    ) {
      return;
    }

    const agora = agoraTimestamp();
    const aceita = solicitacao.status === STATUS_ACEITA;

    if (aceita && pedido.status !== "CANCELADO") {
      transaction.update(pedidoRef, {
        status: "CANCELADO",
        canceladoPor: "CLIENTE_SOLICITACAO",
        canceladoEm: agora,
        atualizadoEm: agora,
      });
    }

    transaction.update(solicitacaoRef, {
      origem: "SERVIDOR",
      respondidaEm: solicitacao.respondidaEm || agora,
    });

    resultado = {
      clienteId: pedido.clienteId,
      pedido: {
        id: pedidoRef.id,
        ...pedido,
        ...(aceita
          ? {
              status: "CANCELADO",
              canceladoPor: "CLIENTE_SOLICITACAO",
              canceladoEm: agora,
            }
          : {}),
      },
      aceita,
    };
  });

  if (resultado?.clienteId) {
    await enviarNotificacaoCliente(
      db,
      resultado.clienteId,
      resultado.pedido,
      resultado.aceita ? "✅ Pedido cancelado" : "❌ Cancelamento recusado",
      resultado.aceita
        ? "O estabelecimento aceitou o cancelamento do seu pedido."
        : "O estabelecimento recusou o cancelamento do seu pedido.",
    );
  }

  await atualizarContadorSolicitacoes(db, pedidoRef);
}

async function processarSolicitacaoAdicionada(db, solicitacaoRef) {
  const pedidoRef = obterPedidoDaSolicitacao(solicitacaoRef);
  if (!pedidoRef) return;

  const [solicitacaoSnap, pedidoSnap] = await Promise.all([
    solicitacaoRef.get(),
    pedidoRef.get(),
  ]);

  if (!solicitacaoSnap.exists || !pedidoSnap.exists) return;

  const solicitacao = {
    id: solicitacaoRef.id,
    ...solicitacaoSnap.data(),
  };
  const pedido = {
    id: pedidoRef.id,
    ...pedidoSnap.data(),
  };

  await atualizarContadorSolicitacoes(db, pedidoRef);

  if (solicitacao.status === "PENDENTE") {
    await enviarNotificacaoSolicitacaoAdmin(db, pedido, solicitacao);
  }
}

/* ==========================================================
   EXPIRAÇÃO AUTOMÁTICA DE 5 MINUTOS
========================================================== */

async function processarPropostasExpiradas(db) {
  try {
    const snapshot = await db
      .collectionGroup(SOLICITACOES_COLLECTION)
      .where("status", "==", STATUS_PROPOSTA)
      .get();

    const agora = Date.now();

    for (const documento of snapshot.docs) {
      const dados = documento.data() || {};
      const aceitaAte = obterDataTimestamp(dados.aceitaAte);

      if (!aceitaAte || aceitaAte.getTime() > agora) continue;

      const pedidoRef = obterPedidoDaSolicitacao(documento.ref);
      if (!pedidoRef) continue;

      let resultado = null;

      await db.runTransaction(async (transaction) => {
        const [solicitacaoSnap, pedidoSnap] = await Promise.all([
          transaction.get(documento.ref),
          transaction.get(pedidoRef),
        ]);

        if (!solicitacaoSnap.exists || !pedidoSnap.exists) return;

        const solicitacao = solicitacaoSnap.data() || {};
        const pedido = pedidoSnap.data() || {};

        const limite = obterDataTimestamp(solicitacao.aceitaAte);
        if (
          solicitacao.status !== STATUS_PROPOSTA ||
          !limite ||
          limite.getTime() > Date.now()
        ) {
          return;
        }

        const agoraTimestampValue = agoraTimestamp();

        transaction.update(documento.ref, {
          origem: "SERVIDOR",
          status: STATUS_ACEITA_TIMEOUT,
          respostaCliente: "ACEITA_TIMEOUT",
          respondidaEm: agoraTimestampValue,
        });

        if (pedido.previsaoEntrega) {
          transaction.update(pedidoRef, {
            "previsaoEntrega.resposta": "ACEITA_TIMEOUT",
            "previsaoEntrega.respondidaEm": agoraTimestampValue,
            atualizadoEm: agoraTimestampValue,
          });
        }

        resultado = {
          clienteId: pedido.clienteId,
          pedido: { id: pedidoRef.id, ...pedido },
          prazoFinal: pedido.previsaoEntrega?.prazoFinal || null,
        };
      });

      if (resultado?.clienteId) {
        await enviarNotificacaoCliente(
          db,
          resultado.clienteId,
          resultado.pedido,
          "✅ Nova previsão confirmada",
          `Não recebemos sua resposta. A proposta foi considerada aceita. Envie o pedido até ${formatarHorario(resultado.prazoFinal)}.`,
        );
      }

      await atualizarContadorSolicitacoes(db, pedidoRef);
    }
  } catch (erro) {
    console.error("[SOLICITAÇÕES] Erro ao processar expirações:", erro);
  }
}

/* ==========================================================
   LISTENER DE SOLICITAÇÕES
========================================================== */

function iniciarListenerSolicitacoes(db) {
  if (solicitacoesListenerIniciado) return;

  solicitacoesListenerIniciado = true;

  console.log(
    "[SOLICITAÇÕES] Iniciando listener de solicitações do cliente...",
  );

  let primeiraLeitura = true;

  db.collectionGroup(SOLICITACOES_COLLECTION).onSnapshot(
    async (snapshot) => {
      if (primeiraLeitura) {
        primeiraLeitura = false;
        console.log(
          `[SOLICITAÇÕES] Primeira leitura ignorada: ${snapshot.size} solicitação(ões).`,
        );

        const pedidosParaAtualizar = new Map();
        for (const documento of snapshot.docs) {
          const pedidoRef = obterPedidoDaSolicitacao(documento.ref);
          if (pedidoRef) pedidosParaAtualizar.set(pedidoRef.path, pedidoRef);
        }
        for (const pedidoRef of pedidosParaAtualizar.values()) {
          await atualizarContadorSolicitacoes(db, pedidoRef);
        }

        await processarPropostasExpiradas(db);
        return;
      }

      for (const change of snapshot.docChanges()) {
        try {
          const dados = change.doc.data() || {};

          if (change.type === "added") {
            await processarSolicitacaoAdicionada(db, change.doc.ref);
            continue;
          }

          if (change.type !== "modified") continue;

          const antes = change.doc._previousData || null;

          if (
            dados.status === STATUS_PROPOSTA &&
            dados.origem === "ADMIN" &&
            !dados.enviadaEm
          ) {
            await processarNovaProposta(db, change.doc.ref);
            continue;
          }

          if (
            dados.tipo === "CANCELAMENTO" &&
            dados.origem === "ADMIN" &&
            [STATUS_ACEITA, STATUS_RECUSADA].includes(dados.status)
          ) {
            await processarRespostaCancelamento(db, change.doc.ref);
            continue;
          }

          if (
            dados.tipo !== "CANCELAMENTO" &&
            dados.status === STATUS_PROPOSTA &&
            ["ACEITA", "RECUSADA"].includes(dados.respostaCliente)
          ) {
            await processarRespostaCliente(db, change.doc.ref);
          }
        } catch (erro) {
          console.error("[SOLICITAÇÕES] Erro ao processar alteração:", erro);
        }
      }
    },
    (erro) => {
      console.error("[SOLICITAÇÕES] Erro no listener:", erro);
    },
  );

  timerSolicitacoes = setInterval(() => {
    processarPropostasExpiradas(db).catch((erro) =>
      console.error("[SOLICITAÇÕES] Erro no timer:", erro),
    );
  }, 15000);
}

/* ==========================================================
   CONFIRMAÇÃO DE RECEBIMENTO PELO CLIENTE
========================================================== */

const CONFIRMACOES_RECEBIMENTO_COLLECTION = "confirmacoesRecebimento";
let confirmacoesRecebimentoListenerIniciado = false;

function obterPedidoDaConfirmacao(confirmacaoRef) {
  return confirmacaoRef?.parent?.parent || null;
}

async function processarConfirmacaoRecebimento(db, confirmacaoRef) {
  const pedidoRef = obterPedidoDaConfirmacao(confirmacaoRef);
  if (!pedidoRef) return;

  try {
    await db.runTransaction(async (transaction) => {
      const [confirmacaoSnap, pedidoSnap] = await Promise.all([
        transaction.get(confirmacaoRef),
        transaction.get(pedidoRef),
      ]);

      if (!confirmacaoSnap.exists || !pedidoSnap.exists) return;

      const confirmacao = confirmacaoSnap.data() || {};
      const pedido = pedidoSnap.data() || {};

      if (confirmacao.status !== "PENDENTE") return;

      const identidadeValida =
        Boolean(confirmacao.uid) &&
        confirmacao.uid === pedido.firebaseUid &&
        Boolean(confirmacao.clienteId) &&
        confirmacao.clienteId === pedido.clienteId;

      const tipo = String(pedido.tipo || "").trim();
      const statusElegivel =
        (tipo === "Delivery" && pedido.status === "SAIU_PARA_ENTREGA") ||
        (tipo === "Retirada" && pedido.status === "PRONTO");

      const agora = agoraTimestamp();

      if (
        pedido.recebimentoConfirmado === true &&
        pedido.status === "ENTREGUE"
      ) {
        transaction.update(confirmacaoRef, {
          status: "CONFIRMADA",
          processadoEm: agora,
        });
        return;
      }

      if (!identidadeValida || !statusElegivel) {
        transaction.update(confirmacaoRef, {
          status: "REJEITADA",
          motivo: "PEDIDO_NAO_ELEGIVEL",
          processadoEm: agora,
        });
        console.warn(
          `[RECEBIMENTO] Solicitação rejeitada para pedido ${pedidoRef.id}: identidade ou status não elegível.`,
        );
        return;
      }

      transaction.update(pedidoRef, {
        status: "ENTREGUE",
        recebimentoConfirmado: true,
        recebimentoConfirmadoEm: agora,
        recebimentoConfirmadoPor: confirmacao.uid,
        atualizadoEm: agora,
      });

      transaction.update(confirmacaoRef, {
        status: "CONFIRMADA",
        processadoEm: agora,
      });
    });
  } catch (erro) {
    console.error(
      `[RECEBIMENTO] Erro ao processar confirmação do pedido ${pedidoRef.id}:`,
      erro,
    );
  }
}

async function processarConfirmacoesRecebimentoPendentes(db) {
  try {
    const snapshot = await db
      .collectionGroup(CONFIRMACOES_RECEBIMENTO_COLLECTION)
      .where("status", "==", "PENDENTE")
      .limit(100)
      .get();

    for (const documento of snapshot.docs) {
      await processarConfirmacaoRecebimento(db, documento.ref);
    }
  } catch (erro) {
    console.error(
      "[RECEBIMENTO] Erro ao recuperar confirmações pendentes:",
      erro,
    );
  }
}

function iniciarListenerConfirmacoesRecebimento(db) {
  if (confirmacoesRecebimentoListenerIniciado) return;
  confirmacoesRecebimentoListenerIniciado = true;

  console.log("[RECEBIMENTO] Iniciando listener de confirmações do cliente...");

  db.collectionGroup(CONFIRMACOES_RECEBIMENTO_COLLECTION).onSnapshot(
    async (snapshot) => {
      // Também recupera solicitações pendentes presentes quando o servidor sobe.
      for (const documento of snapshot.docs) {
        const dados = documento.data() || {};
        if (dados.status === "PENDENTE") {
          await processarConfirmacaoRecebimento(db, documento.ref);
        }
      }
    },
    (erro) => {
      console.error("[RECEBIMENTO] Erro no listener de confirmações:", erro);
      confirmacoesRecebimentoListenerIniciado = false;
    },
  );
}

function statusElegivelParaLembrete(pedido) {
  return (
    (pedido.tipo === "Delivery" && pedido.status === "SAIU_PARA_ENTREGA") ||
    (pedido.tipo === "Retirada" && pedido.status === "PRONTO")
  );
}

async function atualizarAgendamentoLembreteRecebimento(
  db,
  pedidoId,
  statusNovo,
) {
  const pedidoRef = db.collection(PEDIDOS_COLLECTION).doc(pedidoId);

  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(pedidoRef);

      if (!snapshot.exists) return;

      const pedido = snapshot.data() || {};

      // Ignora eventos antigos do listener.
      if (pedido.status !== statusNovo) return;

      if (
        pedido.recebimentoConfirmado === true ||
        pedido.status === "ENTREGUE"
      ) {
        transaction.update(pedidoRef, {
          [CAMPO_STATUS_LEMBRETE]: "CANCELADO",
          [CAMPO_PROCESSAMENTO_LEMBRETE]: FieldValue.delete(),
        });

        return;
      }

      if (!statusElegivelParaLembrete(pedido)) {
        const lembreteAtual = pedido[CAMPO_STATUS_LEMBRETE];

        if (lembreteAtual === "AGENDADO" || lembreteAtual === "ENVIANDO") {
          transaction.update(pedidoRef, {
            [CAMPO_STATUS_LEMBRETE]: "CANCELADO",
            [CAMPO_PROCESSAMENTO_LEMBRETE]: FieldValue.delete(),
          });
        }

        return;
      }

      const prazo = Timestamp.fromDate(
        new Date(Date.now() + TEMPO_LEMBRETE_RECEBIMENTO_MS),
      );

      transaction.update(pedidoRef, {
        [CAMPO_STATUS_LEMBRETE]: "AGENDADO",
        [CAMPO_PRAZO_LEMBRETE]: prazo,
        [CAMPO_STATUS_ESPERADO_LEMBRETE]: statusNovo,
        [CAMPO_PROCESSAMENTO_LEMBRETE]: FieldValue.delete(),
      });

      console.log(
        `[LEMBRETE] Pedido ${pedido.numeroPedido || pedidoId}: ` +
          `lembrete agendado para daqui a 30 minutos.`,
      );
    });
  } catch (erro) {
    console.error(
      `[LEMBRETE] Erro ao atualizar agendamento do pedido ${pedidoId}:`,
      erro,
    );
  }
}

async function processarLembretesRecebimento(db) {
  try {
    const snapshot = await db
      .collection(PEDIDOS_COLLECTION)
      .where(CAMPO_STATUS_LEMBRETE, "==", "AGENDADO")
      .limit(100)
      .get();

    for (const documento of snapshot.docs) {
      const prazo = obterDataTimestamp(documento.get(CAMPO_PRAZO_LEMBRETE));

      if (!prazo || prazo.getTime() > Date.now()) continue;

      await enviarLembreteRecebimento(db, documento.ref);
    }

    // Recupera lembretes interrompidos por reinicialização do servidor.
    const enviando = await db
      .collection(PEDIDOS_COLLECTION)
      .where(CAMPO_STATUS_LEMBRETE, "==", "ENVIANDO")
      .limit(100)
      .get();

    for (const documento of enviando.docs) {
      const inicio = obterDataTimestamp(
        documento.get(CAMPO_PROCESSAMENTO_LEMBRETE),
      );

      if (
        inicio &&
        Date.now() - inicio.getTime() < TEMPO_RECUPERACAO_LEMBRETE_MS
      ) {
        continue;
      }

      await enviarLembreteRecebimento(db, documento.ref);
    }
  } catch (erro) {
    console.error(
      "[LEMBRETE] Erro ao processar lembretes de recebimento:",
      erro,
    );
  }
}

async function enviarLembreteRecebimento(db, pedidoRef) {
  let pedidoParaEnviar = null;

  try {
    const podeEnviar = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(pedidoRef);

      if (!snapshot.exists) return false;

      const pedido = snapshot.data() || {};
      const statusLembrete = pedido[CAMPO_STATUS_LEMBRETE];

      if (statusLembrete !== "AGENDADO" && statusLembrete !== "ENVIANDO") {
        return false;
      }

      const inicio = obterDataTimestamp(pedido[CAMPO_PROCESSAMENTO_LEMBRETE]);

      if (
        statusLembrete === "ENVIANDO" &&
        inicio &&
        Date.now() - inicio.getTime() < TEMPO_RECUPERACAO_LEMBRETE_MS
      ) {
        return false;
      }

      const prazo = obterDataTimestamp(pedido[CAMPO_PRAZO_LEMBRETE]);

      if (
        statusLembrete === "AGENDADO" &&
        (!prazo || prazo.getTime() > Date.now())
      ) {
        return false;
      }

      const statusEsperado = pedido[CAMPO_STATUS_ESPERADO_LEMBRETE];

      if (
        pedido.status !== statusEsperado ||
        !statusElegivelParaLembrete(pedido) ||
        pedido.recebimentoConfirmado === true ||
        pedido.status === "ENTREGUE"
      ) {
        transaction.update(pedidoRef, {
          [CAMPO_STATUS_LEMBRETE]: "CANCELADO",
          [CAMPO_PROCESSAMENTO_LEMBRETE]: FieldValue.delete(),
        });

        return false;
      }

      if (!pedido.clienteId) {
        transaction.update(pedidoRef, {
          [CAMPO_STATUS_LEMBRETE]: "CANCELADO",
          [CAMPO_PROCESSAMENTO_LEMBRETE]: FieldValue.delete(),
        });

        return false;
      }

      transaction.update(pedidoRef, {
        [CAMPO_STATUS_LEMBRETE]: "ENVIANDO",
        [CAMPO_PROCESSAMENTO_LEMBRETE]: FieldValue.serverTimestamp(),
      });

      pedidoParaEnviar = {
        ...pedido,
        id: pedidoRef.id,
      };

      return true;
    });

    if (!podeEnviar || !pedidoParaEnviar) return;

    const resultado = await enviarNotificacaoCliente(
      db,
      pedidoParaEnviar.clienteId,
      pedidoParaEnviar,
      "🔔 Você recebeu seu pedido?",
      "Você poderia confirmar se o pedido foi realmente recebido?",
    );

    if (resultado.successCount > 0) {
      await pedidoRef.update({
        [CAMPO_STATUS_LEMBRETE]: "ENVIADO",
        lembreteRecebimentoEnviadoEm: FieldValue.serverTimestamp(),
        [CAMPO_PROCESSAMENTO_LEMBRETE]: FieldValue.delete(),
      });

      console.log(
        `[LEMBRETE] Notificação enviada para o pedido ` +
          `${pedidoParaEnviar.numeroPedido || pedidoRef.id}.`,
      );
    } else {
      // Tenta novamente depois de um minuto se o FCM falhar.
      await pedidoRef.update({
        [CAMPO_STATUS_LEMBRETE]: "AGENDADO",
        [CAMPO_PRAZO_LEMBRETE]: Timestamp.fromDate(
          new Date(Date.now() + 60 * 1000),
        ),
        [CAMPO_PROCESSAMENTO_LEMBRETE]: FieldValue.delete(),
      });
    }
  } catch (erro) {
    console.error(
      `[LEMBRETE] Erro ao enviar lembrete do pedido ${pedidoRef.id}:`,
      erro,
    );

    // Evita deixar o pedido permanentemente preso em ENVIANDO.
    await pedidoRef
      .update({
        [CAMPO_STATUS_LEMBRETE]: "AGENDADO",
        [CAMPO_PRAZO_LEMBRETE]: Timestamp.fromDate(
          new Date(Date.now() + 60 * 1000),
        ),
        [CAMPO_PROCESSAMENTO_LEMBRETE]: FieldValue.delete(),
      })
      .catch((erroAtualizacao) => {
        console.error(
          "[LEMBRETE] Não foi possível liberar o lembrete:",
          erroAtualizacao,
        );
      });
  }
}

function iniciarNotificacoesPedidos(db) {
  if (listenerIniciado) {
    console.warn("[FCM] Listener de pedidos já está ativo.");
    return;
  }

  listenerIniciado = true;

  console.log("[FCM] Iniciando listener de pedidos e status...");

  let primeiraLeitura = true;
  const statusConhecidos = new Map();
  const processamentosEmAndamento = new Set();

  const mensagensPorStatus = {
    RECEBIDO: {
      titulo: "Pedido recebido",
      corpo: (numero) => `Seu pedido #${numero} foi recebido.`,
    },
    PREPARANDO: {
      titulo: "Em preparação",
      corpo: (numero) => `Seu pedido #${numero} está sendo preparado.`,
    },
    PRONTO: {
      titulo: "Pedido pronto",
      corpo: (numero) => `Seu pedido #${numero} está pronto!`,
    },
    SAIU_PARA_ENTREGA: {
      titulo: "Saiu para entrega",
      corpo: (numero) => `Seu pedido #${numero} saiu para entrega.`,
    },
    CANCELADO: {
      titulo: "Pedido cancelado",
      corpo: (numero) => `Seu pedido #${numero} foi cancelado.`,
    },
  };

  const campoEnviado = "ultimoStatusPushNotificado";
  const campoPendente = "statusPushPendente";
  const campoProcessando = "statusPushEmProcessamento";
  const campoInicio = "statusPushIniciadoEm";

  async function processarStatusCliente(pedidoId, pedido) {
    const status = String(pedido.status || "");
    const mensagem = mensagensPorStatus[status];

    if (!mensagem || !pedido.clienteId) return;

    const chave = `${pedidoId}:${status}`;

    if (processamentosEmAndamento.has(chave)) return;

    processamentosEmAndamento.add(chave);

    const pedidoRef = db.collection(PEDIDOS_COLLECTION).doc(pedidoId);

    try {
      const podeProcessar = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(pedidoRef);

        if (!snapshot.exists) return false;

        const atual = snapshot.data() || {};

        // Não enviar uma notificação de um status que já mudou.
        if (atual.status !== status) return false;

        // Se já foi enviado, limpa qualquer pendência antiga.
        if (atual[campoEnviado] === status) {
          transaction.update(pedidoRef, {
            [campoPendente]: FieldValue.delete(),
            [campoProcessando]: FieldValue.delete(),
            [campoInicio]: FieldValue.delete(),
          });

          return false;
        }

        // Evita concorrência. Uma tentativa abandonada pode ser
        // retomada depois de dois minutos.
        const inicio = obterDataTimestamp(atual[campoInicio]);
        const processamentoRecente =
          atual[campoProcessando] === status &&
          inicio &&
          Date.now() - inicio.getTime() < 120000;

        if (processamentoRecente) return false;

        // Persiste a pendência antes de chamar o FCM.
        transaction.update(pedidoRef, {
          [campoPendente]: status,
          [campoProcessando]: status,
          [campoInicio]: FieldValue.serverTimestamp(),
        });

        return true;
      });

      if (!podeProcessar) return;

      const numero = String(pedido.numeroPedido || pedidoId);

      const resultado = await enviarNotificacaoCliente(
        db,
        pedido.clienteId,
        {
          ...pedido,
          id: pedidoId,
          status,
        },
        mensagem.titulo,
        mensagem.corpo(numero),
      );

      if (resultado.successCount > 0) {
        await pedidoRef.update({
          [campoEnviado]: status,
          statusPushEnviadoEm: FieldValue.serverTimestamp(),
          [campoPendente]: FieldValue.delete(),
          [campoProcessando]: FieldValue.delete(),
          [campoInicio]: FieldValue.delete(),
        });

        console.log(
          `[FCM] Status ${status} enviado para o pedido ${numero}. ` +
            `Sucessos: ${resultado.successCount}; falhas: ${resultado.failureCount}.`,
        );

        if (resultado.failureCount > 0) {
          console.warn(
            `[FCM] Houve falhas parciais no pedido ${numero}. ` +
              "O status foi marcado como enviado para evitar duplicações.",
          );
        }
      } else {
        // Mantém a pendência para uma nova tentativa automática.
        await pedidoRef.update({
          [campoPendente]: status,
          [campoProcessando]: FieldValue.delete(),
          [campoInicio]: FieldValue.delete(),
        });

        console.warn(
          `[FCM] Nenhum envio confirmado para o pedido ${numero}. ` +
            "A notificação permanecerá pendente.",
        );
      }
    } catch (erro) {
      console.error(
        `[FCM] Erro no status ${status} do pedido ${pedidoId}:`,
        erro,
      );

      // Preserva a pendência e libera uma tentativa posterior.
      await pedidoRef
        .update({
          [campoPendente]: status,
          [campoProcessando]: FieldValue.delete(),
          [campoInicio]: FieldValue.delete(),
        })
        .catch((erroLimpeza) => {
          console.error(
            `[FCM] Não foi possível liberar a pendência do pedido ${pedidoId}:`,
            erroLimpeza,
          );
        });
    } finally {
      processamentosEmAndamento.delete(chave);
    }
  }

  async function processarPushPendentes() {
    for (const status of Object.keys(mensagensPorStatus)) {
      try {
        const snapshot = await db
          .collection(PEDIDOS_COLLECTION)
          .where(campoPendente, "==", status)
          .limit(100)
          .get();

        for (const documento of snapshot.docs) {
          const pedido = {
            id: documento.id,
            ...documento.data(),
          };

          await processarStatusCliente(documento.id, pedido);
        }
      } catch (erro) {
        console.error(
          `[FCM] Erro ao recuperar pendências do status ${status}:`,
          erro,
        );
      }
    }
  }

  db.collection(PEDIDOS_COLLECTION).onSnapshot(
    async (snapshot) => {
      if (primeiraLeitura) {
        primeiraLeitura = false;

        for (const documento of snapshot.docs) {
          statusConhecidos.set(documento.id, documento.data()?.status || null);
        }

        console.log(
          `[FCM] Primeira leitura ignorada: ${snapshot.size} pedido(s).`,
        );

        // Recupera pendências deixadas por uma execução anterior.
        await processarPushPendentes();
        return;
      }

      for (const change of snapshot.docChanges()) {
        const pedidoId = change.doc.id;

        if (change.type === "removed") {
          statusConhecidos.delete(pedidoId);
          continue;
        }

        const pedido = {
          id: pedidoId,
          ...change.doc.data(),
        };

        const statusAtual = pedido.status || null;
        const statusAnterior = statusConhecidos.has(pedidoId)
          ? statusConhecidos.get(pedidoId)
          : null;

        statusConhecidos.set(pedidoId, statusAtual);

        if (!statusAtual) continue;

        if (change.type === "added") {
          // Agenda o lembrete se o pedido já entrar em um status elegível.
          if (statusElegivelParaLembrete(pedido)) {
            await atualizarAgendamentoLembreteRecebimento(
              db,
              pedidoId,
              statusAtual,
            );
          }

          if (statusAtual === "RECEBIDO") {
            console.log("[FCM] Novo pedido detectado:", pedido.numeroPedido);

            await contabilizarVendasPedido(db, pedido).catch((erro) =>
              console.error("[VENDAS] Erro ao contabilizar vendas:", erro),
            );

            await enviarNotificacaoNovoPedido(db, pedido);
          }

          await processarStatusCliente(pedidoId, pedido);
          continue;
        }

        // Não reagenda lembretes quando apenas campos auxiliares mudam.
        if (statusAtual === statusAnterior) continue;

        // Agenda ao entrar em um status elegível e cancela se sair dele.
        await atualizarAgendamentoLembreteRecebimento(
          db,
          pedidoId,
          statusAtual,
        );

        await processarStatusCliente(pedidoId, pedido);
      }
    },
    (erro) => {
      console.error("[FCM] Erro no listener de pedidos:", erro);
    },
  );

  iniciarListenerSolicitacoes(db);
  iniciarListenerConfirmacoesRecebimento(db);

  processarConfirmacoesRecebimentoPendentes(db).catch(() => {});

  if (!timerConfirmacoesRecebimento) {
    timerConfirmacoesRecebimento = setInterval(() => {
      processarConfirmacoesRecebimentoPendentes(db).catch((erro) =>
        console.error("[RECEBIMENTO] Erro no timer de recuperação:", erro),
      );
    }, 30000);
  }

  if (!timerLembretesRecebimento) {
    timerLembretesRecebimento = setInterval(() => {
      processarLembretesRecebimento(db).catch((erro) =>
        console.error("[LEMBRETE] Erro no timer de recebimento:", erro),
      );
    }, INTERVALO_LEMBRETES_RECEBIMENTO_MS);
  }

  // Recupera os lembretes que já venceram após iniciar o servidor.
  processarLembretesRecebimento(db).catch((erro) =>
    console.error("[LEMBRETE] Erro na recuperação inicial:", erro),
  );

  processarVendasPendentes(db).catch(() => {});

  timerVendas = setInterval(() => {
    processarVendasPendentes(db).catch((erro) =>
      console.error("[VENDAS] Erro no timer:", erro),
    );
  }, 30000);

  // Recupera falhas transitórias e notificações sem tokens disponíveis.
  timerPushPendentes = setInterval(() => {
    processarPushPendentes().catch((erro) =>
      console.error("[FCM] Erro na recuperação de pendências:", erro),
    );
  }, 30000);
}

module.exports = {
  iniciarNotificacoesPedidos,
};
