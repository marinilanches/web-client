import { db } from "./firebase.js";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function finalizarPedido(data) {
  await addDoc(collection(db, "pedidos"), {
    ...data,
    status: "NOVO",
    pagamentoStatus: "PENDENTE",
    createdAt: serverTimestamp()
  });
}

export function getLocation() {
  navigator.geolocation.getCurrentPosition((pos) => {
    console.log(pos.coords.latitude, pos.coords.longitude);
  });
}