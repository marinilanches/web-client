import { db, auth } from "./firebase.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getMessaging,
  getToken,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ==========================================================
   AUTH CLIENTE
========================================================== */

const CLIENTE_ID_STORAGE_KEY = "mesaFacilClienteId";

function gerarClienteId() {
  if (crypto?.randomUUID) {
    return `web_${crypto.randomUUID().replaceAll("-", "")}`;
  }

  return `web_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function obterClienteIdLocal() {
  return localStorage.getItem(CLIENTE_ID_STORAGE_KEY);
}

export async function garantirClienteAuth() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const resultado = await signInAnonymously(auth);
  return resultado.user;
}

export async function garantirIdentidadeCliente() {
  const user = await garantirClienteAuth();

  const identidadeRef = doc(
    db,
    "clienteIdentidades",
    user.uid,
  );

  const identidadeSnap = await getDoc(identidadeRef);

  if (identidadeSnap.exists()) {
    const dados = identidadeSnap.data();

    if (!dados.clienteId) {
      throw new Error(
        "Identidade do cliente encontrada sem clienteId.",
      );
    }

    localStorage.setItem(
      CLIENTE_ID_STORAGE_KEY,
      dados.clienteId,
    );

    return {
      uid: user.uid,
      clienteId: dados.clienteId,
    };
  }

  let clienteId = obterClienteIdLocal();

  if (!clienteId) {
    clienteId = gerarClienteId();

    localStorage.setItem(
      CLIENTE_ID_STORAGE_KEY,
      clienteId,
    );
  }

  await setDoc(identidadeRef, {
    uid: user.uid,
    clienteId,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });

  return {
    uid: user.uid,
    clienteId,
  };
}

/* ==========================================================
   BUSCAR CLIENTE
========================================================== */

export async function buscarCliente() {
  const identidade = await garantirIdentidadeCliente();

  const ref = doc(
    db,
    "clientes",
    identidade.clienteId,
  );

  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data(),
    clienteId: identidade.clienteId,
    firebaseUid: identidade.uid,
  };
}

/* ==========================================================
   SALVAR CLIENTE
========================================================== */

export async function salvarCliente(dados) {
  const user = await garantirClienteAuth();

  const cliente = {
    nome: dados.nome || "",

    telefone: String(dados.telefone || "").replace(/\D/g, ""),

    telefoneWhatsapp: dados.telefoneWhatsapp || "",

    observacoes: dados.observacoes || "",

    endereco: dados.endereco || {
      rua: "",

      numero: "",

      bairro: "",

      complemento: "",
    },

    atualizadoEm: serverTimestamp(),
  };

  const identidade = await garantirIdentidadeCliente();
  const clienteId = identidade.clienteId;

  const ref = doc(db, "clientes", clienteId);

  const clienteExistente = await getDoc(ref);

  await setDoc(
    ref,
    {
      ...cliente,

      ...(clienteExistente.exists()
        ? {}
        : {
            criadoEm: serverTimestamp(),

            totalPedidos: 0,

            totalGasto: 0,
          }),
    },
    {
      merge: true,
    },
  );

  return {
    id: clienteId,
    clienteId,
    firebaseUid: user.uid,
    ...cliente,
  };
}

/* ==========================================================
   NOTIFICAÇÕES FCM DO CLIENTE
========================================================== */

const VAPID_KEY =
  "BPzI31zrcz1pAmcjaVhDnjr2GmukrR25DNYn8UWwyKnei0yeC_rXyQMHd-oUvX3uq7b_Nob8ozxCqiOi_cfpiTQ";

export async function registrarNotificacoesCliente() {
  try {
    if (!auth.currentUser) {
      await garantirClienteAuth();
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return null;
    }

    let permissao = Notification.permission;

    if (permissao === "default") {
      permissao = await Notification.requestPermission();
    }

    if (permissao !== "granted") {
      return null;
    }

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" },
    );

    await navigator.serviceWorker.ready;

    const messaging = getMessaging(getApp());
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) return null;

    const user = auth.currentUser;

    const tokensRef = collection(db, "clienteNotificationTokens");

    const identidade = await garantirIdentidadeCliente();

    const existente = await getDocs(
      query(
        tokensRef,
        where("uid", "==", identidade.uid),
        where("token", "==", token),
      ),
    );

    if (!existente.empty) {
      await updateDoc(existente.docs[0].ref, {
        uid: user.uid,
        clienteId: identidade.clienteId,
        token,
        ativo: true,
        atualizadoEm: serverTimestamp(),
        userAgent: navigator.userAgent,
        plataforma: navigator.platform,
      });
    } else {
      await addDoc(tokensRef, {
        uid: user.uid,
        clienteId: identidade.clienteId,
        token,
        ativo: true,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
        userAgent: navigator.userAgent,
        plataforma: navigator.platform,
        origem: "CLIENTE_WEB",
      });
    }

    console.log("[Mesa Fácil] Token FCM do cliente registrado.");
    return token;
  } catch (erro) {
    console.error(
      "[Mesa Fácil] Erro ao configurar notificações do cliente:",
      erro,
    );
    return null;
  }
}
