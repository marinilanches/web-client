import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ==========================================================
   MESA FÁCIL
   DELIVERY FEES SERVICE
========================================================== */

const taxasEntregaRef = collection(db, "taxasEntrega");

/* ==========================================================
   HELPERS
========================================================== */

function normalizarNomeBairro(nome = "") {
  return String(nome).trim().replace(/\s+/g, " ");
}

function ordenarTaxas(lista = []) {
  return [...lista].sort((a, b) => {
    const ordemA = Number(a.ordem || 0);
    const ordemB = Number(b.ordem || 0);

    if (ordemA !== ordemB) {
      return ordemA - ordemB;
    }

    const nomeA = String(a.nome || "").toLowerCase();
    const nomeB = String(b.nome || "").toLowerCase();

    return nomeA.localeCompare(nomeB, "pt-BR");
  });
}

/* ==========================================================
   CRIAR
========================================================== */

export async function criarTaxaEntrega(dados) {
  const nome = normalizarNomeBairro(dados.nome);

  const payload = {
    nome,

    taxa: Number(dados.taxa || 0),

    ativo: Boolean(dados.ativo),

    ordem: Number(dados.ordem || 0),

    ruas: Array.isArray(dados.ruas) ? dados.ruas : [],

    criadoEm: serverTimestamp(),

    atualizadoEm: serverTimestamp(),
  };

  return await addDoc(taxasEntregaRef, payload);
}

/* ==========================================================
   EDITAR
========================================================== */

export async function editarTaxaEntrega(id, dados) {
  const updatePayload = {
    ...dados,
    atualizadoEm: serverTimestamp(),
  };

  if ("nome" in dados) {
    updatePayload.nome = normalizarNomeBairro(dados.nome);
  }

  if ("taxa" in dados) {
    updatePayload.taxa = Number(dados.taxa || 0);
  }

  if ("ordem" in dados) {
    updatePayload.ordem = Number(dados.ordem || 0);
  }

  if ("ativo" in dados) {
    updatePayload.ativo = Boolean(dados.ativo);
  }

  if ("ruas" in dados) {
    updatePayload.ruas = Array.isArray(dados.ruas) ? dados.ruas : [];
  }

  await updateDoc(doc(db, "taxasEntrega", id), updatePayload);
}

/* ==========================================================
   EXCLUIR
========================================================== */

export async function excluirTaxaEntrega(id) {
  await deleteDoc(doc(db, "taxasEntrega", id));
}

/* ==========================================================
   BUSCAR UM
========================================================== */

export async function buscarTaxaEntrega(id) {
  const snap = await getDoc(doc(db, "taxasEntrega", id));

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  };
}

/* ==========================================================
   LISTAR
========================================================== */

export async function listarTaxasEntrega() {
  const snapshot = await getDocs(taxasEntregaRef);

  const taxas = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  return ordenarTaxas(taxas);
}

/* ==========================================================
   LISTAR ATIVAS
========================================================== */

export async function listarTaxasEntregaAtivas() {
  const taxas = await listarTaxasEntrega();
  return taxas.filter((item) => item.ativo);
}

/* ==========================================================
   OUVIR
========================================================== */

export function ouvirTaxasEntrega(callback) {
  return onSnapshot(
    taxasEntregaRef,
    (snapshot) => {
      const taxas = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      callback(ordenarTaxas(taxas));
    },
    (erro) => {
      console.error("Erro ao ouvir taxas de entrega:", erro);
    },
  );
}

export async function buscarBairroPorNome(nome) {
  const busca = normalizarNomeBairro(nome).toLowerCase();

  const taxas = await listarTaxasEntrega();

  return (
    taxas.find((bairro) => {
      return (
        normalizarNomeBairro(bairro.nome).toLowerCase() === busca
      );
    }) || null
  );
}

export async function buscarBairrosPorNome(nome) {
  const busca = normalizarNomeBairro(nome).toLowerCase();

  const taxas = await listarTaxasEntrega();

  return taxas.filter((bairro) =>
    normalizarNomeBairro(bairro.nome)
      .toLowerCase()
      .includes(busca),
  );
}

export async function cadastrarBairroAutomaticamente(
  nome,
  taxa,
) {
  const existente = await buscarBairroPorNome(nome);

  if (existente) {
    return existente;
  }

  const taxas = await listarTaxasEntrega();

  const maiorOrdem = taxas.reduce(
    (maior, item) => Math.max(maior, Number(item.ordem || 0)),
    0,
  );

  await criarTaxaEntrega({
    nome,
    taxa,
    ativo: true,
    ordem: maiorOrdem + 1,
    ruas: [],
  });

  return null;
}