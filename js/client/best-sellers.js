import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../services/firebase.js";

/* ==========================================================
   MESA FÁCIL
   BEST SELLERS / MAIS PEDIDOS
========================================================== */

function formatarMoeda(valor) {
  return Number(valor || 0).toFixed(2);
}

function escaparHtml(texto = "") {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ordenarMaisPedidos(a, b) {
  const vendasA = Number(a.vendas || 0);
  const vendasB = Number(b.vendas || 0);

  // maior vendas primeiro
  if (vendasB !== vendasA) {
    return vendasB - vendasA;
  }

  // empate -> ordem alfabética por nome
  const nomeA = String(a.nome || "").toLowerCase();
  const nomeB = String(b.nome || "").toLowerCase();

  return nomeA.localeCompare(nomeB, "pt-BR");
}

export async function carregarMaisPedidos() {
  const container = document.getElementById("produtosMaisPedidos");
  if (!container) return;

  try {
    const produtosRef = collection(db, "produtos");
    const snapshot = await getDocs(produtosRef);

    const produtos = [];

    snapshot.forEach((docItem) => {
      const produto = {
        id: docItem.id,
        ...docItem.data()
      };

      // ignora produtos inativos
      if (produto.ativo === false) return;

      produtos.push({
        ...produto,
        vendas: Number(produto.vendas || 0),
        preco: Number(produto.preco || 0)
      });
    });

    if (!produtos.length) {
      container.innerHTML = `
        <p class="text-secondary mb-0">
          Ainda não existem produtos cadastrados.
        </p>
      `;
      return;
    }

    const maisPedidos = produtos
      .sort(ordenarMaisPedidos)
      .slice(0, 3);

    container.innerHTML = `
      <div class="row g-3 mt-2">
        ${maisPedidos.map((produto) => `
          <div class="col-12">
            <div class="product-card">
              <div class="card-body">
                <h4 class="product-title">
                  🔥 ${escaparHtml(produto.nome || "Produto")}
                </h4>

                <p class="product-description">
                  ${Number(produto.vendas || 0)} vendido(s)
                </p>

                <div class="product-bottom">
                  <strong class="product-price-value">
                    R$ ${formatarMoeda(produto.preco || 0)}
                  </strong>

                  <button
                    class="btn btn-danger btnAdd"
                    data-produto="${encodeURIComponent(JSON.stringify(produto))}"
                    type="button"
                  >
                    + Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  } catch (error) {
    console.error("Erro ao carregar produtos populares:", error);

    container.innerHTML = `
      <p class="text-danger mb-0">
        Erro ao carregar produtos populares.
      </p>
    `;
  }
}