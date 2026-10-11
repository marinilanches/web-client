/* ==========================================================
   MESA FÁCIL
   FIREBASE CLOUD MESSAGING - SERVICE WORKER
========================================================== */

importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js"
);

/* ==========================================================
   FIREBASE
========================================================== */

firebase.initializeApp({
  apiKey: "AIzaSyCv9EjCPGl3SlvHUaRCBShLZhT04aVl8M",
  authDomain: "mesa-facil-62310.firebaseapp.com",
  databaseURL:
    "https://mesa-facil-62310-default-rtdb.firebaseio.com",
  projectId: "mesa-facil-62310",
  storageBucket:
    "mesa-facil-62310.firebasestorage.app",
  messagingSenderId: "170185351689",
  appId: "1:170185351689:web:a3fecbda25e40384ef8ed8",
  measurementId: "G-LWCWGT8WEZ",
});

/* ==========================================================
   FIREBASE MESSAGING
========================================================== */

const messaging = firebase.messaging();

const URL_ADMIN = "/admin/pedidos.html";
const URL_STATUS_CLIENTE = "/status.html";

/* ==========================================================
   VALIDAR DESTINO DA NOTIFICAÇÃO
========================================================== */

function obterUrlNotificacao(data) {
  const urlInformada = data.url || "";
  const origem = String(data.origem || "").toUpperCase();

  if (
    origem === "CLIENTE" &&
    urlInformada.startsWith(URL_STATUS_CLIENTE + "?id=")
  ) {
    return urlInformada;
  }

  if (
    origem === "ADMIN" ||
    urlInformada.startsWith(URL_ADMIN)
  ) {
    return URL_ADMIN;
  }

  // Compatibilidade com notificações antigas de clientes.
  if (urlInformada.startsWith(URL_STATUS_CLIENTE + "?id=")) {
    return urlInformada;
  }

  return URL_ADMIN;
}

/* ==========================================================
   MENSAGEM EM SEGUNDO PLANO
========================================================== */

messaging.onBackgroundMessage((payload) => {
  console.log(
    "[Mesa Fácil] Nova mensagem em segundo plano:",
    payload
  );

  const notification = payload.notification || {};
  const data = payload.data || {};

  const titulo =
    notification.title ||
    data.title ||
    "🔔 Novo pedido recebido";

  const corpo =
    notification.body ||
    data.body ||
    "Há um novo pedido aguardando atendimento.";

  const numeroPedido = data.numeroPedido || "";
  const url = obterUrlNotificacao(data);
  const origem =
    String(data.origem || "").toUpperCase() ||
    (url.startsWith("/admin/") ? "ADMIN" : "CLIENTE");

  const icone =
    origem === "ADMIN"
      ? "/assets/admin-icon.png"
      : "/assets/avatar.png";

  const notificationOptions = {
    body: corpo,
    icon: icone,
    badge: icone,
    tag: numeroPedido
      ? `pedido-${numeroPedido}`
      : `notificacao-${origem.toLowerCase()}`,
    renotify: true,
    data: {
      url,
      numeroPedido,
      origem,
    },
  };

  return self.registration.showNotification(
    titulo,
    notificationOptions
  );
});

/* ==========================================================
   CLIQUE NA NOTIFICAÇÃO
========================================================== */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const url = obterUrlNotificacao(data);

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(async (clientList) => {
        // Prioriza uma aba que já esteja no destino correto.
        const destinoAtual = new URL(url, self.location.origin);

        const clienteExistente = clientList.find((client) => {
          try {
            const urlCliente = new URL(client.url);

            return (
              urlCliente.origin === destinoAtual.origin &&
              urlCliente.pathname === destinoAtual.pathname &&
              urlCliente.search === destinoAtual.search
            );
          } catch {
            return false;
          }
        });

        if (clienteExistente) {
          await clienteExistente.focus();
          return;
        }

        // Reutiliza outra aba aberta, se possível.
        const abaDisponivel = clientList.find(
          (client) => "focus" in client && "navigate" in client
        );

        if (abaDisponivel) {
          await abaDisponivel.focus();
          await abaDisponivel.navigate(destinoAtual.href);
          return;
        }

        // Abre uma nova aba se não houver nenhuma disponível.
        if (clients.openWindow) {
          return clients.openWindow(destinoAtual.href);
        }
      })
  );
});