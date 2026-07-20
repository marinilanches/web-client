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

function distanciaLevenshtein(a, b) {
  const matriz = [];

  for (let i = 0; i <= b.length; i++) {
    matriz[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matriz[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matriz[i][j] = matriz[i - 1][j - 1];
      } else {
        matriz[i][j] = Math.min(
          matriz[i - 1][j - 1] + 1,
          matriz[i][j - 1] + 1,
          matriz[i - 1][j] + 1,
        );
      }
    }
  }

  return matriz[b.length][a.length];
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

  console.log("DADOS RECEBIDOS PARA CRIAR:", dados);

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

  console.log("PAYLOAD FIRESTORE:", payload);

  const ref = await addDoc(taxasEntregaRef, payload);

  console.log("CRIADO COM ID:", ref.id);

  return ref;
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

  const busca = normalizarNomeBairro(nome)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const taxas = await listarTaxasEntrega();

  if (!busca) return null;


  // 1) tenta encontrar exatamente
  const exato = taxas.find((bairro) => {

    const nomeBanco = normalizarNomeBairro(bairro.nome)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return nomeBanco === busca;

  });


  if (exato) return exato;


  // 2) tenta encontrar por aproximação
  let melhor = null;
  let menorDistancia = Infinity;


  for (const bairro of taxas) {

    const nomeBanco = normalizarNomeBairro(bairro.nome)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");


    const distancia = distanciaLevenshtein(
      busca,
      nomeBanco
    );


    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      melhor = bairro;
    }
  }


  // aceita até 35% de diferença
  const limite = Math.max(
    2,
    Math.floor(melhor.nome.length * 0.35)
  );


  if (melhor && menorDistancia <= limite) {

    console.log("Bairro encontrado por aproximação:", {
      digitado: nome,
      encontrado: melhor.nome,
      distancia: menorDistancia,
    });

    return melhor;
  }


  return null;
}

export async function buscarBairrosPorNome(nome) {
  const busca = normalizarNomeBairro(nome).toLowerCase();

  const taxas = await listarTaxasEntrega();

  return taxas.filter((bairro) =>
    normalizarNomeBairro(bairro.nome).toLowerCase().includes(busca),
  );
}

export async function cadastrarBairroAutomaticamente(nome, taxa, rua) {
  console.log("CADASTRAR BAIRRO AUTOMATICAMENTE:", {
    nome,
    taxa,
    rua,
  });
  const existente = await buscarBairroPorNome(nome);
  console.log("BAIRRO EXISTENTE:", existente);

  if (existente) {
    if (rua && !existente.ruas?.includes(rua)) {
      const novoArray = [...(existente.ruas || []), rua];

      await editarTaxaEntrega(existente.id, {
        ruas: novoArray,
      });
    }

    return existente;
  }

  const taxas = await listarTaxasEntrega();

  const maiorOrdem = taxas.reduce(
    (maior, item) => Math.max(maior, Number(item.ordem || 0)),
    0,
  );
  console.log("CRIANDO NOVO BAIRRO NO FIRESTORE");

  await criarTaxaEntrega({
    nome,
    taxa,
    ativo: true,
    ordem: maiorOrdem + 1,
    ruas: rua ? [rua] : [],
  });

  return null;
}
