import { db } from "./firebase.js";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc
} from "firebase/firestore";

onSnapshot(collection(db, "pedidos"), (snap) => {
  const box = document.getElementById("pedidos");
  box.innerHTML = "";

  snap.forEach(d => {
    const p = d.data();

    box.innerHTML += `
      <div>
        <h3>Mesa ${p.numeroMesa}</h3>
        <p>${p.status}</p>

        <button onclick="pronto('${d.id}')">
          ✔ PRONTO
        </button>
      </div>
    `;
  });
});

window.pronto = async (id) => {
  await updateDoc(doc(db, "pedidos", id), {
    status: "PRONTO"
  });
};