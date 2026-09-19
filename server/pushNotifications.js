const {
  getMessaging,
} = require("firebase-admin/messaging");

const {
  getFirestore,
  FieldPath,
} = require("firebase-admin/firestore");

/* ==========================================================
   CONFIGURAÇÃO
========================================================== */

const TOKENS_COLLECTION =
  "adminNotificationTokens";

const PEDIDOS_COLLECTION =
  "pedidos";

const URL_PEDIDOS =
  "/admin/pedidos.html";

/* ==========================================================
   CONTROLE
========================================================== */

let listenerIniciado = false;

/* ==========================================================
   LIMPAR TOKENS INVÁLIDOS
========================================================== */

async function removerTokensInvalidos(
  db,
  tokens,
  responses
) {
  for (
    let i = 0;
    i < responses.length;
    i++
  ) {
    const response = responses[i];

    if (response.success) {
      continue;
    }

    const erro = response.error;

    const codigo =
      erro?.code || "";

    /*
     * Token não existe mais ou não é válido.
     */

    const tokenInvalido =
      codigo ===
        "messaging/registration-token-not-registered" ||
      codigo ===
        "messaging/invalid-registration-token";

    if (!tokenInvalido) {
      continue;
    }

    const token = tokens[i];

    try {
      const snapshot =
        await db
          .collection(TOKENS_COLLECTION)
          .where("token", "==", token)
          .get();

      const batch =
        db.batch();

      snapshot.forEach(
        (documento) => {
          batch.delete(
            documento.ref
          );
        }
      );

      await batch.commit();

      console.log(
        "[FCM] Token inválido removido."
      );

    } catch (erroRemocao) {
      console.error(
        "[FCM] Erro ao remover token inválido:",
        erroRemocao
      );
    }
  }
}

/* ==========================================================
   ENVIAR NOTIFICAÇÃO
========================================================== */

async function enviarNotificacaoNovoPedido(
  db,
  pedido
) {
  try {
    const snapshot =
      await db
        .collection(TOKENS_COLLECTION)
        .where("ativo", "==", true)
        .get();

    if (snapshot.empty) {
      console.log(
        "[FCM] Nenhum navegador cadastrado para notificações."
      );

      return;
    }

    const tokens = [];

    snapshot.forEach(
      (documento) => {
        const dados =
          documento.data();

        if (
          dados.token &&
          typeof dados.token ===
            "string"
        ) {
          tokens.push(
            dados.token
          );
        }
      }
    );

    if (!tokens.length) {
      console.log(
        "[FCM] Nenhum token válido encontrado."
      );

      return;
    }

    /*
     * O Admin SDK permite até 500 destinos
     * em uma chamada multicast.
     */

    const grupos = [];

    for (
      let i = 0;
      i < tokens.length;
      i += 500
    ) {
      grupos.push(
        tokens.slice(
          i,
          i + 500
        )
      );
    }

    const messaging =
      getMessaging();

    for (
      const grupo of grupos
    ) {

      const message = {
        notification: {
          title:
            "🔔 Novo pedido recebido",

          body:
            `Pedido #${
              pedido.numeroPedido || "----"
            } recebido.`,
        },

        data: {
          numeroPedido:
            String(
              pedido.numeroPedido || ""
            ),

          pedidoId:
            String(
              pedido.id || ""
            ),

          status:
            String(
              pedido.status || "RECEBIDO"
            ),

          url:
            URL_PEDIDOS,

          title:
            "🔔 Novo pedido recebido",

          body:
            `Pedido #${
              pedido.numeroPedido || "----"
            } recebido.`,
        },

        webpush: {
          fcmOptions: {
            link:
              URL_PEDIDOS,
          },

          notification: {
            icon:
              "/assets/admin-icon.png",

            badge:
              "/assets/admin-icon.png",

            tag:
              `pedido-${
                pedido.id
              }`,
          },
        },

        tokens: grupo,
      };

      const resposta =
        await messaging
          .sendEachForMulticast(
            message
          );

      console.log(
        `[FCM] ${
          resposta.successCount
        } notificação(ões) enviada(s). ${
          resposta.failureCount
        } falha(s).`
      );

      await removerTokensInvalidos(
        db,
        grupo,
        resposta.responses
      );
    }

  } catch (erro) {
    console.error(
      "[FCM] Erro ao enviar notificação de novo pedido:",
      erro
    );
  }
}

/* ==========================================================
   INICIAR LISTENER
========================================================== */

function iniciarNotificacoesPedidos(db) {

  if (listenerIniciado) {
    console.warn(
      "[FCM] Listener de pedidos já está ativo."
    );

    return;
  }

  listenerIniciado = true;

  console.log(
    "[FCM] Iniciando listener de novos pedidos..."
  );

  let primeiraLeitura = true;

  db.collection(PEDIDOS_COLLECTION)
    .onSnapshot(
      (snapshot) => {

        /*
         * O primeiro snapshot contém os documentos
         * que já existiam.
         *
         * NÃO devemos notificar esses pedidos.
         */

        if (primeiraLeitura) {

          primeiraLeitura = false;

          console.log(
            `[FCM] Primeira leitura ignorada: ${snapshot.size} pedido(s).`
          );

          return;
        }

        snapshot
          .docChanges()
          .forEach(
            (change) => {

              /*
               * Só documentos realmente novos.
               */

              if (
                change.type !==
                "added"
              ) {
                return;
              }

              const pedido = {
                id:
                  change.doc.id,

                ...change.doc.data(),
              };

              /*
               * Só pedidos RECEBIDOS.
               */

              if (
                pedido.status !==
                "RECEBIDO"
              ) {
                return;
              }

              console.log(
                "[FCM] Novo pedido detectado:",
                pedido.numeroPedido
              );

              enviarNotificacaoNovoPedido(
                db,
                pedido
              );
            }
          );
      },

      (erro) => {
        console.error(
          "[FCM] Erro no listener de pedidos:",
          erro
        );
      }
    );
}

/* ==========================================================
   EXPORTAR
========================================================== */

module.exports = {
  iniciarNotificacoesPedidos,
};
