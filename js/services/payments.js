import { db } from "./firebase.js";
import { addDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function criarPagamento(pedidoId, valorTotal) {
  await addDoc(collection(db, "pagamentos"), {
    pedidoId,
    valorTotal,
    status: "PENDENTE",
    forma: "PIX"
  });
}