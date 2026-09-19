import { ouvirPedidos } from "../../js/services/orders.js";
import { toast } from "../components/toast.js";

import { db } from "../../js/services/firebase.js";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
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

/*
 * COLE AQUI A PUBLIC KEY VAPID GERADA NO FIREBASE CONSOLE.
 *
 * Firebase Console
 * → Configurações do projeto
 * → Cloud Messaging
 * → Web Push certificates
 * → Generate key pair
 */

const VAPID_KEY =
  "BPzI31zrcz1pAmcjaVhDnjr2GmukrR25DNYn8UWwyKnei0yeC_rXyQMHd-oUvX3uq7b_Nob8ozxCqiOi_cfpiTQ";

/*
 * URL que será aberta ao clicar na notificação.
 */

const URL_PEDIDOS =
  "/admin/pedidos.html";

/* ==========================================================
   SOM
========================================================== */

let primeiraLeitura = true;

const pedidosRecebidos = new Set();

const audioNovoPedido = new Audio(
  "../../assets/sounds/novo-pedido.mp3"
);

audioNovoPedido.loop = true;
audioNovoPedido.volume = 1;

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

    if (!VAPID_KEY ||
        VAPID_KEY === "COLE_AQUI_SUA_CHAVE_PUBLICA_VAPID") {

      console.warn(
        "[Mesa Fácil] Chave VAPID ainda não configurada."
      );

      return;
    }

    /* ======================================================
       PERMISSÃO
    ====================================================== */

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

    /* ======================================================
       SERVICE WORKER
    ====================================================== */

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

    /* ======================================================
       MESSAGING
    ====================================================== */

    const app = getApp();

    const messaging = getMessaging(app);

    /* ======================================================
       TOKEN FCM
    ====================================================== */

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

    /* ======================================================
       SALVAR TOKEN NO FIRESTORE
    ====================================================== */

    await salvarTokenNotificacao(token);

    /* ======================================================
       MENSAGENS EM PRIMEIRO PLANO
    ====================================================== */

    onMessage(messaging, (payload) => {
      console.log(
        "[Mesa Fácil] Mensagem FCM em primeiro plano:",
        payload
      );

      /*
       * Não mostramos outra notificação do Windows aqui.
       *
       * Quando o admin está aberto, o sistema atual
       * continua responsável pelo:
       *
       * 🔊 som
       * 🔔 toast
       *
       * O FCM fica responsável principalmente pelo
       * segundo plano.
       */
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

      userAgent:
        navigator.userAgent,

      plataforma:
        navigator.platform,

      origem:
        "ADMIN_WEB",
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
   INICIAR PUSH
========================================================== */

configurarNotificacoesPush();

/* ==========================================================
   NOTIFICADOR ATUAL
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
