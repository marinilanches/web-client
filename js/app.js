import { db } from "../firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp
} from "firebase/firestore";

// =============================
// 🧠 ESTADO DO CARRINHO
// =============================
let carrinho = [];
let total = 0;
let qtd = 0;

// =============================
// 🍔 CARREGAR PRODUTOS
// =============================
async function loadProducts() {
  const snap = await getDocs(collection(db, "produtos"));
  const container = document.getElementById("produtos");

  container.innerHTML = "";

  snap.forEach((doc) => {
    const p = doc.data();

    container.innerHTML += `
      <div class="item">
        <div>
          <h4>${p.nome}</h4>
          <p>${p.descricao || ""}</p>
          <span>R$ ${p.preco}</span>
        </div>

        <button onclick="addItem('${p.nome}', ${p.preco})">
          Adicionar
        </button>
      </div>
    `;
  });
}

// =============================
// 🛒 ADICIONAR AO CARRINHO
// =============================
window.addItem = (nome, preco) => {
  carrinho.push({
    nome,
    quantidade: 1,
    valorUnitario: preco
  });

  qtd++;
  total += preco;

  updateUI();

  localStorage.setItem("carrinho", JSON.stringify(carrinho));
};

// =============================
// 🔄 UI
// =============================
function updateUI() {
  document.getElementById("qtd").innerText = qtd;
  document.getElementById("total").innerText = total.toFixed(2);
}

// =============================
// 🚀 FINALIZAR PEDIDO
// =============================
async function finalizarPedido() {
  if (carrinho.length === 0) {
    alert("Carrinho vazio!");
    return;
  }

  try {
    await addDoc(collection(db, "pedidos"), {
      itens: carrinho,
      valorTotal: total,
      status: "NOVO",

      clienteId: null,
      mesaId: null,

      pagamentoStatus: "PENDENTE",

      createdAt: serverTimestamp()
    });

    alert("Pedido enviado com sucesso!");

    carrinho = [];
    total = 0;
    qtd = 0;

    updateUI();

  } catch (e) {
    console.error("Erro ao enviar pedido:", e);
  }
}

// =============================
// 🔥 BOTÃO FINALIZAR
// =============================
document.getElementById("finalizarBtn")
  .addEventListener("click", finalizarPedido);

// =============================
// INIT
// =============================
loadProducts();