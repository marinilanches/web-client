import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const adicionaisRef = collection(db, "adicionais");

function normalizarAdicional(docItem) {
  const data = docItem.data();

  return {
    id: docItem.id,
    nome: data.nome || "",
    preco: Number(data.preco || 0),
    ativo: data.ativo !== false,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

export async function listarAdicionais() {
  const q = query(adicionaisRef, orderBy("nome", "asc"));

  const snap = await getDocs(q);

  return snap.docs
    .map(normalizarAdicional)
    .filter((item) => item.ativo !== false);
}

export async function buscarAdicional(id) {
  if (!id) return null;

  const snap = await getDoc(doc(db, "adicionais", id));
  if (!snap.exists()) return null;

  const data = snap.data();

  return {
    id: snap.id,
    nome: data.nome || "",
    preco: Number(data.preco || 0),
    ativo: data.ativo !== false,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

export async function criarAdicional(dados) {
  return addDoc(adicionaisRef, {
    nome: String(dados.nome || "").trim(),
    preco: Number(dados.preco || 0),
    ativo: dados.ativo ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function editarAdicional(id, dados) {
  await updateDoc(doc(db, "adicionais", id), {
    nome: String(dados.nome || "").trim(),
    preco: Number(dados.preco || 0),
    ativo: dados.ativo ?? true,
    updatedAt: serverTimestamp()
  });
}

export async function excluirAdicional(id) {
  await deleteDoc(doc(db, "adicionais", id));
}

export function ouvirAdicionais(callback) {
  const q = query(adicionaisRef, orderBy("nome", "asc"));

  return onSnapshot(q, (snapshot) => {
    const lista = snapshot.docs.map(normalizarAdicional);
    callback(lista);
  });
}