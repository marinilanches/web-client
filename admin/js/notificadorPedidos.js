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
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import { authPronto } from "../../js/services/firebase.js";

import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";

/* ==========================================================
   CONFIGURAÇÃO
========================================================== */

const VAPID_KEY =
  "BPzI31zrcz1pAmcjaVhDnjr2GmukrR25DNYN8UWwyKnei0yeC_rXyQMHd-oUvX3uq7b_Nob8ozxCqiOi_cfpiTQ";

const URL_PEDIDOS = "/admin/pedidos.html";

/* ==========================================================
   SONS
========================================================== */

let primeiraLeitura = true;
let primeiraLeituraSolicitacoes = true;

/* ----------------------------------------------------------
   NOVO PEDIDO
---------------------------------------------------------- */

const pedidosRecebidos = new Set();

const audioNovoPedido = new Audio("../../assets/sounds/novo-pedido.mp3");

audioNovoPedido.loop = true;
audioNovoPedido.volume = 1;

/* ----------------------------------------------------------
   NOVA SOLICITAÇÃO
---------------------------------------------------------- */

const solicitacoesPendentes = new Set();

const solicitacoesNaoAbertas = new Set();

const audioNovaSolicitacao = new Audio(
  "../../assets/sounds/nova-solicitacao.mp3",
);

audioNovaSolicitacao.loop = true;
audioNovaSolicitacao.volume = 1;

/* ==========================================================
   FIREBASE MESSAGING
========================================================== */

async function configurarNotificacoesPush() {
  try {
    if (!("Notification" in window)) {
      console.warn("[Mesa Fácil] Este navegador não suporta notificações.");

      return;
    }

    if (!("serviceWorker" in navigator)) {
      console.warn("[Mesa Fácil] Service Worker não disponível.");

      return;
    }

    if (!VAPID_KEY || VAPID_KEY === "COLE_AQUI_SUA_CHAVE_PUBLICA_VAPID") {
      console.warn("[Mesa Fácil] Chave VAPID ainda não configurada.");

      return;
    }

    let permissao = Notification.permission;

    if (permissao === "default") {
      permissao = await Notification.requestPermission();
    }

    if (permissao !== "granted") {
      console.warn("[Mesa Fácil] Permissão de notificações não concedida.");

      return;
    }

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      {
        scope: "/",
      },
    );

    console.log("[Mesa Fácil] Service Worker registrado:", registration.scope);

    await navigator.serviceWorker.ready;

    const app = getApp();
    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn("[Mesa Fácil] Não foi possível obter o token FCM.");

      return;
    }

    console.log("[Mesa Fácil] Token FCM obtido.");

    await salvarTokenNotificacao(token);

    onMessage(messaging, (payload) => {
      console.log("[Mesa Fácil] Mensagem FCM em primeiro plano:", payload);
    });
  } catch (erro) {
    console.error("[Mesa Fácil] Erro ao configurar notificações:", erro);
  }
}

/* ==========================================================
   SALVAR TOKEN
========================================================== */

async function salvarTokenNotificacao(token) {
  try {
    const tokensRef = collection(db, "adminNotificationTokens");

    const q = query(tokensRef, where("token", "==", token));

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const documento = snapshot.docs[0];

      await updateDoc(doc(db, "adminNotificationTokens", documento.id), {
        token,
        ativo: true,
        atualizadoEm: new Date(),
        userAgent: navigator.userAgent,
        plataforma: navigator.platform,
      });

      console.log("[Mesa Fácil] Token FCM atualizado.");

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

    console.log("[Mesa Fácil] Token FCM registrado.");
  } catch (erro) {
    console.error("[Mesa Fácil] Erro ao salvar token FCM:", erro);
  }
}

/* ==========================================================
   MONITORAR SOLICITAÇÕES
========================================================== */

function ouvirNovasSolicitacoes() {
  const solicitacoesRef = collectionGroup(db, "solicitacoes");

  const q = query(solicitacoesRef, where("status", "==", "PENDENTE"));

  return onSnapshot(
    q,
    async (snapshot) => {
      console.log(
        "[Mesa Fácil] Snapshot de solicitações recebido:",
        snapshot.size,
      );

      /*
       * PRIMEIRA LEITURA
       *
       * Apenas registra as solicitações que já estavam pendentes.
       * Elas não devem disparar som nem toast.
       */
      if (primeiraLeituraSolicitacoes) {
        snapshot.docs.forEach((solicitacao) => {
          solicitacoesPendentes.add(solicitacao.id);
        });

        primeiraLeituraSolicitacoes = false;

        console.log(
          "[Mesa Fácil] Solicitações pendentes iniciais:",
          solicitacoesPendentes.size,
        );

        atualizarSomSolicitacoes();

        return;
      }

      /*
       * ALTERAÇÕES POSTERIORES
       */
      for (const change of snapshot.docChanges()) {
        const solicitacao = change.doc;
        const solicitacaoId = solicitacao.id;

        /*
         * A solicitação deixou de ser PENDENTE.
         */
        if (change.type === "removed") {
          solicitacoesPendentes.delete(solicitacaoId);
          solicitacoesNaoAbertas.delete(solicitacaoId);

          continue;
        }

        /*
         * Só processamos novas solicitações.
         */
        if (change.type !== "added") {
          continue;
        }

        /*
         * Segurança contra duplicação.
         */
        if (solicitacoesPendentes.has(solicitacaoId)) {
          continue;
        }

        solicitacoesPendentes.add(solicitacaoId);
        solicitacoesNaoAbertas.add(solicitacaoId);

        /*
         * Descobrir o pedido pai.
         *
         * pedidos/{pedidoId}/solicitacoes/{solicitacaoId}
         */
        const pedidoRef = solicitacao.ref.parent.parent;
        const pedidoId = pedidoRef?.id ?? null;

        let numeroPedido = pedidoId || "desconhecido";

        if (pedidoId) {
          try {
            const pedidoSnapshot = await getDoc(doc(db, "pedidos", pedidoId));

            if (pedidoSnapshot.exists()) {
              const pedido = pedidoSnapshot.data();

              numeroPedido = pedido.numeroPedido ?? pedidoId;
            }
          } catch (erro) {
            console.warn(
              "[Mesa Fácil] Não foi possível carregar o pedido da solicitação:",
              erro,
            );
          }
        }

        const dados = solicitacao.data();

        const tipo = dados.tipo || "SOLICITAÇÃO";
        const mensagem = dados.mensagem || "";

        atualizarSomSolicitacoes();

        toast(
          `🔔 Nova solicitação<br>
           Pedido #${numeroPedido}<br>
           ${tipo}${mensagem ? `<br>${mensagem}` : ""}`,
          "success",
        );
      }

      /*
       * Se não houver solicitações novas abertas,
       * garante que o áudio fique parado.
       */
      atualizarSomSolicitacoes();
    },
    (erro) => {
      console.error("[Mesa Fácil] Erro ao ouvir solicitações:", erro);
    },
  );
}

function atualizarSomSolicitacoes() {
  if (solicitacoesNaoAbertas.size > 0) {
    audioNovaSolicitacao.currentTime = 0;
    audioNovaSolicitacao.play().catch(() => {});
    return;
  }

  audioNovaSolicitacao.pause();
  audioNovaSolicitacao.currentTime = 0;
}

export function marcarSolicitacoesComoAbertas(ids) {
  for (const id of ids || []) {
    solicitacoesNaoAbertas.delete(id);
  }

  atualizarSomSolicitacoes();
}

/* ==========================================================
   INICIAR SISTEMA DE NOTIFICAÇÕES
========================================================== */

authPronto.then(async (user) => {
  console.log("[Mesa Fácil] Autenticação pronta. Usuário:", {
    uid: user?.uid ?? null,
    email: user?.email ?? null,
  });

  if (!user) {
    console.warn(
      "[Mesa Fácil] Nenhum usuário autenticado. Notificadores não iniciados.",
    );

    return;
  }

  const tokenResult = await user.getIdTokenResult(true);

  console.log("[AUTH DEBUG COMPLETO]", {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    claims: tokenResult.claims,
    token: (await user.getIdToken()).slice(0, 30) + "...",
  });

  console.log("[AUTH DEBUG] Claims:", tokenResult.claims);

  try {
    const teste = await getDocs(query(collection(db, "configuracoes")));

    console.log("[FIRESTORE TESTE ADMIN] OK:", teste.size);
  } catch (erro) {
    console.error("[FIRESTORE TESTE ADMIN] ERRO:", erro);
  }

  try {
    const testePedidos = await getDocs(query(collection(db, "pedidos")));

    console.log("[FIRESTORE TESTE PEDIDOS ADMIN] OK:", testePedidos.size);
  } catch (erro) {
    console.error("[FIRESTORE TESTE PEDIDOS ADMIN] ERRO:", erro);
  }

  try {
    const testeSolicitacoes = await getDocs(
      query(
        collectionGroup(db, "solicitacoes"),
        where("status", "==", "PENDENTE"),
      ),
    );

    console.log(
      "[FIRESTORE TESTE SOLICITACOES ADMIN] OK:",
      testeSolicitacoes.size,
    );
  } catch (erro) {
    console.error("[FIRESTORE TESTE SOLICITACOES ADMIN] ERRO:", erro);
  }

  await configurarNotificacoesPush();

  ouvirNovasSolicitacoes();

  ouvirPedidos(
    (pedidos) => {
      if (primeiraLeitura) {
        pedidos
          .filter((p) => p.status === "RECEBIDO")
          .forEach((p) => pedidosRecebidos.add(p.id));

        primeiraLeitura = false;

        console.log(
          "[Mesa Fácil] Pedidos recebidos na leitura inicial:",
          pedidosRecebidos.size,
        );

        return;
      }

      pedidos.forEach((pedido) => {
        if (pedido.status === "RECEBIDO" && !pedidosRecebidos.has(pedido.id)) {
          pedidosRecebidos.add(pedido.id);

          console.log(
            "[Mesa Fácil] 🔔 Novo pedido detectado:",
            pedido.id,
            pedido.numeroPedido,
          );

          audioNovoPedido.currentTime = 0;

          audioNovoPedido.play().catch((erro) => {
            console.warn(
              "[Mesa Fácil] Não foi possível reproduzir o som do novo pedido:",
              erro,
            );
          });

          toast(
            `🔔 Novo pedido recebido<br>
           Pedido #${pedido.numeroPedido}`,
            "success",
          );
        }
      });

      const existePedidoRecebido = pedidos.some(
        (pedido) => pedido.status === "RECEBIDO",
      );

      if (!existePedidoRecebido) {
        audioNovoPedido.pause();
        audioNovoPedido.currentTime = 0;
        pedidosRecebidos.clear();
      }
    },
    (erro) => {
      console.error(
        "[Mesa Fácil] Erro no listener de pedidos do notificador:",
        erro,
      );
    },
  );
});
