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
  if (!tokens.length) return;

  const messaging = getMessaging();

  for (let i = 0; i < tokens.length; i += 500) {
    const grupo = tokens.slice(i, i + 500);
    const resposta = await messaging.sendEachForMulticast({
      ...messageBase,
      tokens: grupo,
    });

    console.log(
      `[FCM] ${resposta.successCount} notificação(ões) enviada(s). ${resposta.failureCount} falha(s).`,
    );

    await removerTokensInvalidos(db, collectionName, grupo, resposta.responses);
  }
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
    if (!clienteId) return;

    const tokens = await obterTokensAtivos(db, CLIENT_TOKENS_COLLECTION, {
      clienteId,
    });

    if (!tokens.length) return;

    const url = obterUrlStatus(pedido.id);

    await enviarMulticast(db, CLIENT_TOKENS_COLLECTION, tokens, {
      notification: {
        title: titulo,
        body: corpo,
      },

      data: {
        pedidoId: String(pedido.id),
        numeroPedido: String(pedido.numeroPedido || ""),
        status: String(pedido.status || ""),
        url,
        title: titulo,
        body: corpo,
      },

      webpush: {
        fcmOptions: {
          link: url,
        },

        notification: {
          icon: "/assets/avatar.png",
          badge: "/assets/avatar.png",
          tag: `pedido-cliente-${pedido.id}`,
        },
      },
    });
  } catch (erro) {
    console.error("[FCM] Erro ao notificar cliente:", erro);
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
      resultado.aceita
        ? "✅ Pedido cancelado"
        : "❌ Cancelamento recusado",
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
   LISTENER DOS PEDIDOS
========================================================== */

function iniciarNotificacoesPedidos(db) {
  if (listenerIniciado) {
    console.warn("[FCM] Listener de pedidos já está ativo.");
    return;
  }

  listenerIniciado = true;

  console.log("[FCM] Iniciando listener de novos pedidos...");

  let primeiraLeitura = true;

  db.collection(PEDIDOS_COLLECTION).onSnapshot(
    async (snapshot) => {
      if (primeiraLeitura) {
        primeiraLeitura = false;
        console.log(
          `[FCM] Primeira leitura ignorada: ${snapshot.size} pedido(s).`,
        );
        return;
      }

      for (const change of snapshot.docChanges()) {
        if (change.type !== "added") continue;

        const pedido = {
          id: change.doc.id,
          ...change.doc.data(),
        };

        if (pedido.status !== "RECEBIDO") continue;

        console.log("[FCM] Novo pedido detectado:", pedido.numeroPedido);

        await contabilizarVendasPedido(db, pedido).catch((erro) =>
          console.error("[VENDAS] Erro ao contabilizar vendas:", erro),
        );

        await enviarNotificacaoNovoPedido(db, pedido);
      }
    },
    (erro) => {
      console.error("[FCM] Erro no listener de pedidos:", erro);
    },
  );

  iniciarListenerSolicitacoes(db);

  processarVendasPendentes(db).catch(() => {});
  timerVendas = setInterval(() => {
    processarVendasPendentes(db).catch((erro) =>
      console.error("[VENDAS] Erro no timer:", erro),
    );
  }, 30000);
}

module.exports = {
  iniciarNotificacoesPedidos,
};
