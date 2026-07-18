import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function criarPagamento(pedidoId, valorTotal) {
  await addDoc(collection(db, "pagamentos"), {
    pedidoId,
    valorTotal,
    status: "PENDENTE",
    forma: "PIX"
  });
}

export async function carregarFormasPagamento() {
  const snap = await getDoc(
    doc(db, "configuracoes", "geral")
  );

  if (!snap.exists()) return [];

  const pagamentos = snap.data().pagamentos || [];

  return pagamentos.filter((p) => p.ativo);
}