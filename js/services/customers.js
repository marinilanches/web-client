import { db, auth } from "./firebase.js";

import {
  doc,
 getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ==========================================================
   AUTH CLIENTE
========================================================== */

export async function garantirClienteAuth() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const resultado = await signInAnonymously(auth);
  return resultado.user;
}

/* ==========================================================
   BUSCAR CLIENTE
========================================================== */

export async function buscarCliente() {
  const user = await garantirClienteAuth();

  const ref = doc(db, "clientes", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data()
  };
}

/* ==========================================================
   SALVAR CLIENTE
========================================================== */

export async function salvarCliente(dados) {
  const user = await garantirClienteAuth();

  const cliente = {
    nome: dados.nome || "",
    telefone: dados.telefone || "",
    telefoneWhatsapp: dados.telefoneWhatsapp || "",
    atualizadoEm: serverTimestamp()
  };

  const ref = doc(db, "clientes", user.uid);

  await setDoc(
    ref,
    {
      ...cliente,
      criadoEm: serverTimestamp()
    },
    { merge: true }
  );

  return {
    id: user.uid,
    ...cliente
  };
}