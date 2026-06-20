import { db } from "./firebase.js";
import { addDoc, collection } from "firebase/firestore";

export async function criarPagamento(pedidoId, valorTotal) {
  await addDoc(collection(db, "pagamentos"), {
    pedidoId,
    valorTotal,
    status: "PENDENTE",
    forma: "PIX"
  });
}