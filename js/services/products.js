import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ==========================================================
   MESA FÁCIL
   PRODUCTS SERVICE
========================================================== */

const produtosRef = collection(db, "produtos");

/* ==========================================================
   HELPERS
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

/* ==========================================================
   CRIAR PRODUTO
========================================================== */

export async function criarProduto(dados) {
  try {
    const produto = {
      nome: dados.nome || "",
      descricao: dados.descricao || "",
      preco: Number(dados.preco || 0),
      categoria: dados.categoria || "",
      ativo: dados.ativo ?? true,
      vendas: Number(dados.vendas || 0),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    return await addDoc(produtosRef, produto);
  } catch (erro) {
    console.error("Erro ao criar produto:", erro);
    throw erro;
  }
}

/* ==========================================================
   EDITAR PRODUTO
========================================================== */

export async function editarProduto(id, dados) {
  try {
    await updateDoc(doc(db, "produtos", id), {
      ...dados,
      updatedAt: serverTimestamp()
    });
  } catch (erro) {
    console.error("Erro ao editar produto:", erro);
    throw erro;
  }
}

/* ==========================================================
   EXCLUIR PRODUTO
========================================================== */

export async function excluirProduto(id) {
  try {
    await deleteDoc(doc(db, "produtos", id));
  } catch (erro) {
    console.error("Erro ao excluir produto:", erro);
    throw erro;
  }
}

/* ==========================================================
   BUSCAR PRODUTO
========================================================== */

export async function buscarProduto(id) {
  try {
    const produto = await getDoc(doc(db, "produtos", id));

    if (!produto.exists()) {
      return null;
    }

    return {
      id: produto.id,
      ...produto.data()
    };
  } catch (erro) {
    console.error("Erro ao buscar produto:", erro);
    throw erro;
  }
}

/* ==========================================================
   LISTAR PRODUTOS
========================================================== */

export async function listarProdutos() {
  try {
    const q = query(produtosRef, orderBy("nome", "asc"));
    const snap = await getDocs(q);

    const produtos = [];

    snap.forEach((docItem) => {
      const data = docItem.data();

      // se tiver ativo=false, não mostra no cardápio do cliente
      if (data.ativo === false) return;

      produtos.push({
        id: docItem.id,
        ...data
      });
    });

    return produtos;
  } catch (erro) {
    console.error("Erro ao listar produtos:", erro);
    throw erro;
  }
}

/* ==========================================================
   OUVIR PRODUTOS
========================================================== */

export function ouvirProdutos(callback) {
  const q = query(produtosRef, orderBy("nome", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const produtos = [];

      snapshot.forEach((docItem) => {
        produtos.push({
          id: docItem.id,
          ...docItem.data()
        });
      });

      callback(produtos);
    },
    (erro) => {
      console.error("Erro ao ouvir produtos:", erro);
    }
  );
}

/* ==========================================================
   CLIENTE: CARREGAR PRODUTOS NA TELA
========================================================== */

export async function loadProducts() {
  const container = document.getElementById("produtos");
  if (!container) return;

  const produtos = await listarProdutos();

  if (!produtos.length) {
    container.innerHTML = `
      <div class="col-12">
        <div class="card border-0 shadow-sm rounded-4">
          <div class="card-body p-4 text-center">
            <div class="mb-3 fs-1">🍔</div>
            <h3 class="h5 fw-bold mb-2">Nenhum produto disponível</h3>
            <p class="text-secondary mb-0">
              O cardápio ainda não possui itens ativos.
            </p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = produtos.map((p) => {
    const nome = escaparHtml(p.nome || "");
    const descricao = escaparHtml(p.descricao || "Sem descrição no momento.");
    const categoria = escaparHtml(p.categoria || "Cardápio");
    const preco = Number(p.preco || 0);

    return `
      <div class="col-12 col-md-6 product-col">
        <article class="product-card card border-0">
          <div class="card-body">
            <div class="product-top">
              <div class="product-content">
                <div class="product-badge">
                  <i class="bi bi-stars"></i>
                  <span>${categoria}</span>
                </div>

                <h4 class="product-title">${nome}</h4>
                <p class="product-description">${descricao}</p>
              </div>
            </div>

            <div class="product-bottom">
              <div class="product-price">
                <span class="product-price-label">A partir de</span>
                <strong class="product-price-value">R$ ${formatarMoeda(preco)}</strong>
              </div>

              <button
                class="btn btn-danger btn-add-product btnAdd"
                data-nome="${nome}"
                data-preco="${preco}"
                type="button"
              >
                <i class="bi bi-plus-lg me-1"></i>
                Adicionar
              </button>
            </div>
          </div>
        </article>
      </div>
    `;
  }).join("");
}