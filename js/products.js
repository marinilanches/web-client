import { db } from "./firebase.js";
import { collection, onSnapshot } from "firebase/firestore";

onSnapshot(collection(db, "produtos"), (snap) => {
  const lista = [];

  snap.forEach(d => {
    lista.push(d.data());
  });

  lista.sort((a, b) => b.vendas - a.vendas);

  console.log("🔥 Mais pedidos:", lista);
});