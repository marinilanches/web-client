import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "XXX",
  authDomain: "XXX",
  projectId: "XXX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let total = 0;
let qtd = 0;

async function loadProducts() {
  const snap = await getDocs(collection(db, "produtos"));
  const container = document.getElementById("produtos");

  snap.forEach(doc => {
    const p = doc.data();

    container.innerHTML += `
      <div class="item">
        <div>
          <h4>${p.nome}</h4>
          <p>${p.descricao}</p>
          <span>R$ ${p.preco}</span>
        </div>
        <button onclick="add(${p.preco})">Adicionar</button>
      </div>
    `;
  });
}

window.add = (price) => {
  qtd++;
  total += price;

  document.getElementById("qtd").innerText = qtd;
  document.getElementById("total").innerText = total;
};

loadProducts();