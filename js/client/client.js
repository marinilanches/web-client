import { db } from "../services/firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let carrinho = [];

onSnapshot(collection(db, "produtos"), (snap) => {
  const container = document.getElementById("produtos");
  container.innerHTML = "";

  snap.forEach(doc => {
    const p = doc.data();

    container.innerHTML += `
      <div class="item ${p.ativo ? "" : "off"}">
        <h3>${p.nome}</h3>
        <p>${p.categoria}</p>
        <strong>R$ ${p.preco}</strong>

        <button onclick="add('${doc.id}', '${p.nome}', ${p.preco})">
          Adicionar
        </button>
      </div>
    `;
  });
});

window.add = (id, nome, preco) => {
  carrinho.push({ id, nome, preco, qtd: 1 });
  console.log(carrinho);
};