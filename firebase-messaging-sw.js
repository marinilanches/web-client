/* ==========================================================
   MESA FÁCIL
   FIREBASE CLOUD MESSAGING - SERVICE WORKER
========================================================== */

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
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

  const numeroPedido =
    data.numeroPedido || "";

  const url =
    data.url ||
    "/admin/pedidos.html";

  const notificationOptions = {
    body: corpo,
    icon: "/assets/admin-icon.png",
    badge: "/assets/admin-icon.png",

    tag: numeroPedido
      ? `pedido-${numeroPedido}`
      : "novo-pedido",

    renotify: true,

    data: {
      url,
      numeroPedido,
      origem: data.origem || (url.includes("/admin/") ? "ADMIN" : "CLIENTE"),
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

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const url =
      event.notification?.data?.url ||
      "/admin/pedidos.html";

    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then((clientList) => {
          for (const client of clientList) {
            if ("focus" in client) {
              return client.focus().then(() => {
                if ("navigate" in client) {
                  return client.navigate(url);
                }
              });
            }
          }

          if (clients.openWindow) {
            return clients.openWindow(url);
          }
        })
    );
  }
);
