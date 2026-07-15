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
  serverTimestamp,
  increment,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ==========================================================
   MESA FÁCIL
   PRODUCTS SERVICE
========================================================== */

const produtosRef = collection(db, "produtos");

/* ==========================================================
   CLOUDINARY
========================================================== */

const CLOUDINARY_CLOUD_NAME = "mikxwjs6";
const CLOUDINARY_UPLOAD_PRESET = "jyen9l3f";
const CLOUDINARY_UPLOAD_URL =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

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

function gerarNomeSeguroArquivo(nome = "") {
  return String(nome)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/* ==========================================================
   CLOUDINARY UPLOAD
========================================================== */

export async function uploadImagemProduto(arquivo, nomeProduto = "produto") {
  try {
    if (!arquivo) {
      return {
        url: "",
        publicId: ""
      };
    }

    const formData = new FormData();

    formData.append("file", arquivo);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "mesa-facil/produtos");
    formData.append("public_id", `${gerarNomeSeguroArquivo(nomeProduto)}-${Date.now()}`);

    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro Cloudinary:", data);
      throw new Error(data?.error?.message || "Falha ao enviar imagem para o Cloudinary.");
    }

    return {
      url: data.secure_url || "",
      publicId: data.public_id || ""
    };
  } catch (erro) {
    console.error("Erro ao fazer upload da imagem do produto:", erro);
    throw erro;
  }
}

/* ==========================================================
   CRIAR PRODUTO
========================================================== */

export async function criarProduto(dados) {
  try {
    let imagem = "";
    let imagemPublicId = "";

    if (dados.imagemFile instanceof File) {
      const upload = await uploadImagemProduto(
        dados.imagemFile,
        dados.nome || "produto"
      );

      imagem = upload.url;
      imagemPublicId = upload.publicId;
    } else {
      imagem = dados.imagem || "";
      imagemPublicId = dados.imagemPublicId || "";
    }

    const produto = {
      nome: dados.nome || "",
      descricao: dados.descricao || "",
      preco: Number(dados.preco || 0),
      categoria: dados.categoria || "",
      imagem,
      imagemPublicId,
      ativo: dados.ativo ?? true,
      vendas: Number(dados.vendas || 0),
      gruposPersonalizacao: Array.isArray(dados.gruposPersonalizacao)
        ? dados.gruposPersonalizacao
        : [],
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
    const produtoAtual = await buscarProduto(id);

    if (!produtoAtual) {
      throw new Error("Produto não encontrado para edição.");
    }

    const updatePayload = {
      nome: dados.nome ?? produtoAtual.nome ?? "",
      descricao: dados.descricao ?? produtoAtual.descricao ?? "",
      preco: Number(dados.preco ?? produtoAtual.preco ?? 0),
      categoria: dados.categoria ?? produtoAtual.categoria ?? "",
      gruposPersonalizacao: Array.isArray(dados.gruposPersonalizacao)
        ? dados.gruposPersonalizacao
        : (produtoAtual.gruposPersonalizacao || []),
      updatedAt: serverTimestamp()
    };

    if (dados.imagemFile instanceof File) {
      const upload = await uploadImagemProduto(
        dados.imagemFile,
        dados.nome || produtoAtual.nome || "produto"
      );

      updatePayload.imagem = upload.url;
      updatePayload.imagemPublicId = upload.publicId;
    }

    await updateDoc(doc(db, "produtos", id), updatePayload);
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

export async function alterarStatusProduto(id, ativo) {
  try {
    await updateDoc(doc(db, "produtos", id), {
      ativo,
      updatedAt: serverTimestamp()
    });
  } catch (erro) {
    console.error("Erro ao alterar status do produto:", erro);
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
   INCREMENTAR VENDAS DOS PRODUTOS
========================================================== */

export async function incrementarVendasProdutos(itens = []) {
  try {
    if (!Array.isArray(itens) || !itens.length) return;

    const atualizacoes = itens
      .filter((item) => item?.produtoId)
      .map((item) => {
        const quantidade = Number(item.quantidade || 1);

        return updateDoc(doc(db, "produtos", item.produtoId), {
          vendas: increment(quantidade),
          updatedAt: serverTimestamp()
        });
      });

    await Promise.all(atualizacoes);
  } catch (erro) {
    console.error("Erro ao incrementar vendas dos produtos:", erro);
    throw erro;
  }
}

/* ==========================================================
   LISTAR PRODUTOS MAIS VENDIDOS
========================================================== */

export async function listarProdutosMaisVendidos(limite = 3) {
  try {
    const q = query(
      produtosRef,
      orderBy("vendas", "desc"),
      orderBy("nome", "asc"),
      limit(limite)
    );

    const snap = await getDocs(q);

    const produtos = [];

    snap.forEach((docItem) => {
      const data = docItem.data();

      if (data.ativo === false) return;

      produtos.push({
        id: docItem.id,
        ...data
      });
    });

    return produtos;
  } catch (erro) {
    console.error("Erro ao listar produtos mais vendidos:", erro);
    throw erro;
  }
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

  const ordemCategorias = [
    "Hambúrgueres",
    "Cachorros-quentes",
    "Carnes especiais",
    "Frango",
    "Salames e embutidos",
    "Lanches simples",
    "Bebidas"
  ];

  const grupos = {};

  produtos.forEach((produto) => {
    const categoria = (produto.categoria || "Outros").trim();

    if (!grupos[categoria]) {
      grupos[categoria] = [];
    }

    grupos[categoria].push(produto);
  });

  const categoriasExistentes = Object.keys(grupos);

  const categoriasOrdenadas = [
    ...ordemCategorias.filter((cat) => categoriasExistentes.includes(cat)),
    ...categoriasExistentes
      .filter((cat) => !ordemCategorias.includes(cat))
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
  ];

  container.innerHTML = categoriasOrdenadas.map((categoria) => {
    const produtosDaCategoria = grupos[categoria];

    return `
      <section class="menu-category-section col-12">
        <div class="section-heading d-flex align-items-center justify-content-between mb-3 mt-2">
          <div>
            <h3 class="section-title mb-1">${escaparHtml(categoria)}</h3>
            <p class="section-subtitle mb-0">
              ${produtosDaCategoria.length} item(ns)
            </p>
          </div>
        </div>

        <div class="row g-3">
          ${produtosDaCategoria.map((p) => {
            const nome = escaparHtml(p.nome || "");
            const descricao =
  categoria === "Bebidas"
    ? ""
    : escaparHtml(p.descricao || "Sem descrição no momento.");
            const preco = Number(p.preco || 0);
            const imagem = escaparHtml(p.imagem || "");
            const produtoPayload = encodeURIComponent(JSON.stringify({
              id: p.id,
              nome: p.nome || "",
              descricao: p.descricao || "",
              preco: Number(p.preco || 0),
              categoria: p.categoria || "",
              imagem: p.imagem || "",
              gruposPersonalizacao: Array.isArray(p.gruposPersonalizacao)
                ? p.gruposPersonalizacao
                : [],
              adicionais: Array.isArray(p.adicionais)
                ? p.adicionais
                : []
            }));

            return `
              <div class="col-12 col-md-6 product-col">
                <article class="product-card card border-0">
                  ${imagem ? `
                    <div class="product-thumb-wrap">
                      <img
                        src="${imagem}"
                        alt="${nome}"
                        class="product-thumb"
                        loading="lazy"
                      >
                    </div>
                  ` : ""}

                  <div class="card-body">
                    <div class="product-top">
                      <div class="product-content">
                        <div class="product-badge">
                          <i class="bi bi-stars"></i>
                          <span>${escaparHtml(categoria)}</span>
                        </div>

                        <h4 class="product-title">${nome}</h4>
                        ${descricao ? `<p class="product-description">${descricao}</p>` : ""}
                      </div>
                    </div>

                    <div class="product-bottom">
                      <div class="product-price">
                        <span class="product-price-label">A partir de</span>
                        <strong class="product-price-value">R$ ${formatarMoeda(preco)}</strong>
                      </div>

                      <button
                        class="btn btn-danger btn-add-product btnAdd"
                        data-produto="${produtoPayload}"
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
          }).join("")}
        </div>
      </section>
    `;
  }).join("");
}

/* ==========================================================
   PRODUTOS MAIS PEDIDOS
========================================================== */

export async function loadMaisPedidos() {
  const container = document.getElementById("produtosMaisPedidos");
  if (!container) return;

  const produtos = await listarProdutos();

  const maisPedidos = produtos
    .sort((a, b) => Number(b.vendas || 0) - Number(a.vendas || 0))
    .slice(0, 3);

  if (!maisPedidos.length) {
    container.innerHTML = `
      <p class="mb-0 text-secondary">
        Nenhum produto vendido ainda.
      </p>
    `;
    return;
  }

  container.innerHTML = maisPedidos.map((produto) => {
    return `
      <div class="small mb-1">
        🔥 ${escaparHtml(produto.nome)}
      </div>
    `;
  }).join("");
}
