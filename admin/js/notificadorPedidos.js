import { ouvirPedidos } from "../../js/services/orders.js";
import { toast } from "../components/toast.js";

import { db } from "../../js/services/firebase.js";

import {
  collection,
  collectionGroup,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

/* ==========================================================
   CONFIGURAÇÃO
========================================================== */

const VAPID_KEY =
  "BPzI31zrcz1pAmcjaVhDnjr2GmukrR25DNYN8UWwyKnei0yeC_rXyQMHd-oUvX3uq7b_Nob8ozxCqiOi_cfpiTQ";

const URL_PEDIDOS =
  "/admin/pedidos.html";

/* ==========================================================
   SONS
========================================================== */

let primeiraLeitura = true;
let primeiraLeituraSolicitacoes = true;

/* ----------------------------------------------------------
   NOVO PEDIDO
---------------------------------------------------------- */

const pedidosRecebidos = new Set();

const audioNovoPedido = new Audio(
  "../../assets/sounds/novo-pedido.mp3"
);

audioNovoPedido.loop = true;
audioNovoPedido.volume = 1;

/* ----------------------------------------------------------
   NOVA SOLICITAÇÃO
---------------------------------------------------------- */

const solicitacoesPendentes = new Set();

const audioNovaSolicitacao = new Audio(
  "../../assets/sounds/nova-solicitacao.mp3"
);

audioNovaSolicitacao.loop = true;
audioNovaSolicitacao.volume = 1;

/* ==========================================================
   FIREBASE MESSAGING
========================================================== */

async function configurarNotificacoesPush() {
  try {
    if (!("Notification" in window)) {
      console.warn(
        "[Mesa Fácil] Este navegador não suporta notificações."
      );

      return;
    }

    if (!("serviceWorker" in navigator)) {
      console.warn(
        "[Mesa Fácil] Service Worker não disponível."
      );

      return;
    }

    if (
      !VAPID_KEY ||
      VAPID_KEY === "COLE_AQUI_SUA_CHAVE_PUBLICA_VAPID"
    ) {
      console.warn(
        "[Mesa Fácil] Chave VAPID ainda não configurada."
      );

      return;
    }

    let permissao = Notification.permission;

    if (permissao === "default") {
      permissao =
        await Notification.requestPermission();
    }

    if (permissao !== "granted") {
      console.warn(
        "[Mesa Fácil] Permissão de notificações não concedida."
      );

      return;
    }

    const registration =
      await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        {
          scope: "/",
        }
      );

    console.log(
      "[Mesa Fácil] Service Worker registrado:",
      registration.scope
    );

    await navigator.serviceWorker.ready;

    const app = getApp();
    const messaging = getMessaging(app);

    const token = await getToken(
      messaging,
      {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      }
    );

    if (!token) {
      console.warn(
        "[Mesa Fácil] Não foi possível obter o token FCM."
      );

      return;
    }

    console.log(
      "[Mesa Fácil] Token FCM obtido."
    );

    await salvarTokenNotificacao(token);

    onMessage(messaging, (payload) => {
      console.log(
        "[Mesa Fácil] Mensagem FCM em primeiro plano:",
        payload
      );
    });

  } catch (erro) {
    console.error(
      "[Mesa Fácil] Erro ao configurar notificações:",
      erro
    );
  }
}

/* ==========================================================
   SALVAR TOKEN
========================================================== */

async function salvarTokenNotificacao(token) {
  try {
    const tokensRef = collection(
      db,
      "adminNotificationTokens"
    );

    const q = query(
      tokensRef,
      where("token", "==", token)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const documento = snapshot.docs[0];

      await updateDoc(
        doc(
          db,
          "adminNotificationTokens",
          documento.id
        ),
        {
          token,
          ativo: true,
          atualizadoEm: new Date(),
          userAgent: navigator.userAgent,
          plataforma: navigator.platform,
        }
      );

      console.log(
        "[Mesa Fácil] Token FCM atualizado."
      );

      return;
    }

    await addDoc(tokensRef, {
      token,
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      userAgent: navigator.userAgent,
      plataforma: navigator.platform,
      origem: "ADMIN_WEB",
    });

    console.log(
      "[Mesa Fácil] Token FCM registrado."
    );

  } catch (erro) {
    console.error(
      "[Mesa Fácil] Erro ao salvar token FCM:",
      erro
    );
  }
}

/* ==========================================================
   MONITORAR SOLICITAÇÕES
========================================================== */

function ouvirNovasSolicitacoes() {

  const solicitacoesRef =
    collectionGroup(db, "solicitacoes");

  const q = query(
    solicitacoesRef,
    where("status", "==", "PENDENTE")
  );

  return onSnapshot(
    q,
    async (snapshot) => {

      /* ====================================================
         PRIMEIRA LEITURA
      ==================================================== */

      if (primeiraLeituraSolicitacoes) {

        snapshot.docs.forEach((solicitacao) => {
          solicitacoesPendentes.add(
            solicitacao.id
          );
        });

        primeiraLeituraSolicitacoes = false;

        console.log(
          "[Mesa Fácil] Solicitações pendentes iniciais:",
          solicitacoesPendentes.size
        );

        return;
      }

      /* ====================================================
         NOVAS SOLICITAÇÕES
      ==================================================== */

      for (const change of snapshot.docChanges()) {

        if (change.type !== "added") {
          continue;
        }

        const solicitacao = change.doc;

        const solicitacaoId =
          solicitacao.id;

        /*
         * Evita tocar novamente caso o mesmo documento
         * apareça novamente no listener.
         */

        if (
          solicitacoesPendentes.has(
            solicitacaoId
          )
        ) {
          continue;
        }

        solicitacoesPendentes.add(
          solicitacaoId
        );

        /* ==================================================
           IDENTIFICAR PEDIDO PAI
        ================================================== */

        const pedidoRef =
          solicitacao.ref.parent.parent;

        const pedidoId =
          pedidoRef?.id ?? null;

        let numeroPedido =
          pedidoId || "desconhecido";

        if (pedidoId) {
          try {

            const pedidoSnapshot =
              await getDoc(
                doc(
                  db,
                  "pedidos",
                  pedidoId
                )
              );

            if (pedidoSnapshot.exists()) {

              const pedido =
                pedidoSnapshot.data();

              numeroPedido =
                pedido.numeroPedido ??
                pedidoId;
            }

          } catch (erro) {

            console.warn(
              "[Mesa Fácil] Não foi possível carregar o pedido da solicitação:",
              erro
            );
          }
        }

        /* ==================================================
           DADOS DA SOLICITAÇÃO
        ================================================== */

        const dados =
          solicitacao.data();

        const tipo =
          dados.tipo || "SOLICITAÇÃO";

        const mensagem =
          dados.mensagem || "";

        /* ==================================================
           SOM
        ================================================== */

        audioNovaSolicitacao.currentTime = 0;

        audioNovaSolicitacao
          .play()
          .catch(() => {});

        /* ==================================================
           TOAST
        ================================================== */

        toast(
          `🔔 Nova solicitação<br>
           Pedido #${numeroPedido}<br>
           ${tipo}${mensagem ? `<br>${mensagem}` : ""}`,
          "success"
        );

      }

      /* ====================================================
         EXISTEM SOLICITAÇÕES PENDENTES?
      ==================================================== */

      if (snapshot.empty) {

        audioNovaSolicitacao.pause();

        audioNovaSolicitacao.currentTime = 0;

        solicitacoesPendentes.clear();
      }

    },
    (erro) => {

      console.error(
        "[Mesa Fácil] Erro ao ouvir solicitações:",
        erro
      );

    }
  );
}

/* ==========================================================
   INICIAR PUSH
========================================================== */

configurarNotificacoesPush();

/* ==========================================================
   INICIAR MONITORAMENTO DE SOLICITAÇÕES
========================================================== */

ouvirNovasSolicitacoes();

/* ==========================================================
   NOTIFICADOR DE PEDIDOS
========================================================== */

ouvirPedidos((pedidos) => {

  /* ========================================================
     PRIMEIRA LEITURA
  ======================================================== */

  if (primeiraLeitura) {

    pedidos
      .filter(
        (p) =>
          p.status === "RECEBIDO"
      )
      .forEach(
        (p) =>
          pedidosRecebidos.add(p.id)
      );

    primeiraLeitura = false;

    return;
  }

  /* ========================================================
     NOVOS PEDIDOS
  ======================================================== */

  pedidos.forEach((pedido) => {

    if (
      pedido.status === "RECEBIDO" &&
      !pedidosRecebidos.has(pedido.id)
    ) {

      pedidosRecebidos.add(
        pedido.id
      );

      /* ====================================================
         SOM
      ==================================================== */

      audioNovoPedido.currentTime = 0;

      audioNovoPedido
        .play()
        .catch(() => {});

      /* ====================================================
         TOAST
      ==================================================== */

      toast(
        `🔔 Novo pedido recebido<br>
         Pedido #${pedido.numeroPedido}`,
        "success"
      );
    }

  });

  /* ========================================================
     EXISTEM PEDIDOS RECEBIDOS?
  ======================================================== */

  const existePedidoRecebido =
    pedidos.some(
      (pedido) =>
        pedido.status === "RECEBIDO"
    );

  if (!existePedidoRecebido) {

    audioNovoPedido.pause();

    audioNovoPedido.currentTime = 0;

    pedidosRecebidos.clear();
  }

});