import { abrirModal, fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

import {
  ouvirProdutos,
  criarProduto,
  editarProduto,
  excluirProduto
} from "../../js/services/products.js";

/* ==========================================
   CONFIG
========================================== */

const CATEGORIAS = [
  "Hambúrgueres",
  "Cachorros-quentes",
  "Carnes especiais",
  "Frango",
  "Salames e embutidos",
  "Lanches simples",
  "Bebidas"
];

/* ==========================================
   ELEMENTOS
========================================== */

let listaProdutos;
let btnNovoProduto;
let buscarProduto;
let categoriaFiltro;

let produtosCache = [];

/* ==========================================
   INIT
========================================== */

function initProdutos() {
  listaProdutos = document.getElementById("listaProdutos");
  btnNovoProduto = document.getElementById("novoProduto");
  buscarProduto = document.getElementById("buscarProduto");
  categoriaFiltro = document.getElementById("categoriaFiltro");

  popularFiltroCategorias();

  ouvirProdutos((produtos) => {
    produtosCache = produtos;
    aplicarFiltros();
  });

  buscarProduto?.addEventListener("input", aplicarFiltros);
  categoriaFiltro?.addEventListener("change", aplicarFiltros);
  btnNovoProduto?.addEventListener("click", abrirModalNovoProduto);
}

/* ==========================================
   HELPERS
========================================== */

function escapeHtml(texto = "") {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarPreco(valor) {
  return Number(valor || 0).toFixed(2);
}

function popularFiltroCategorias() {
  if (!categoriaFiltro) return;

  categoriaFiltro.innerHTML = `
    <option value="">Todas categorias</option>
    ${CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join("")}
  `;
}

function gerarOptionsCategoria(categoriaAtual = "") {
  return CATEGORIAS.map((categoria) => `
    <option value="${categoria}" ${categoria === categoriaAtual ? "selected" : ""}>
      ${categoria}
    </option>
  `).join("");
}

function renderPreviewFile(file, previewEl) {
  if (!previewEl) return;

  if (!file) {
    previewEl.innerHTML = `<div class="produto-preview-empty">Sem imagem</div>`;
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    previewEl.innerHTML = `
      <img
        src="${reader.result}"
        alt="Preview"
        class="produto-preview-img"
      >
    `;
  };

  reader.readAsDataURL(file);
}

/* ==========================================
   FILTROS
========================================== */

function aplicarFiltros() {
  let produtos = [...produtosCache];

  const termo = buscarProduto?.value?.trim().toLowerCase() || "";
  const categoria = categoriaFiltro?.value?.trim() || "";

  if (termo) {
    produtos = produtos.filter((produto) => {
      const nome = (produto.nome || "").toLowerCase();
      const descricao = (produto.descricao || "").toLowerCase();
      const categoriaProduto = (produto.categoria || "").toLowerCase();

      return (
        nome.includes(termo) ||
        descricao.includes(termo) ||
        categoriaProduto.includes(termo)
      );
    });
  }

  if (categoria) {
    produtos = produtos.filter((produto) => produto.categoria === categoria);
  }

  renderProdutos(produtos);
}

/* ==========================================
   RENDER
========================================== */

function renderProdutos(produtos) {
  if (!listaProdutos) return;

  if (!produtos.length) {
    listaProdutos.innerHTML = `
      <div class="empty-state">
        <h3>Nenhum produto encontrado</h3>
        <p>Os produtos cadastrados aparecerão aqui.</p>
      </div>
    `;
    return;
  }

  listaProdutos.innerHTML = "";

  produtos.forEach((produto) => {
    const card = document.createElement("div");
    card.className = "panel produto-admin-card";

    const imagem = produto.imagem?.trim() || "";

    card.innerHTML = `
      <div class="produto-admin-top">
        <div class="produto-admin-thumb-wrap">
          ${
            imagem
              ? `<img src="${escapeHtml(imagem)}" alt="${escapeHtml(produto.nome || "Produto")}" class="produto-admin-thumb">`
              : `<div class="produto-admin-thumb produto-admin-thumb--empty">🍔</div>`
          }
        </div>

        <div class="produto-admin-info">
          <div class="panel-title">
            ${escapeHtml(produto.nome || "Produto sem nome")}
          </div>

          <p><strong>Preço:</strong> R$ ${formatarPreco(produto.preco || 0)}</p>
          <p><strong>Categoria:</strong> ${escapeHtml(produto.categoria || "-")}</p>
          <p><strong>Descrição:</strong> ${escapeHtml(produto.descricao || "-")}</p>
          <p><strong>Vendas:</strong> ${produto.vendas ?? 0}</p>
        </div>
      </div>

      <div class="produto-admin-actions">
        <button class="btn btn-primary btn-editar-produto">✏️ Editar</button>
        <button class="btn btn-secondary btn-excluir-produto">🗑 Excluir</button>
      </div>
    `;

    card.querySelector(".btn-editar-produto")?.addEventListener("click", () => {
      abrirModalEditarProduto(produto);
    });

    card.querySelector(".btn-excluir-produto")?.addEventListener("click", async () => {
      const confirmar = confirm(`Excluir o produto "${produto.nome}"?`);
      if (!confirmar) return;

      try {
        await excluirProduto(produto.id);
        toast("Produto excluído com sucesso!");
      } catch (erro) {
        console.error(erro);
        toast("Erro ao excluir produto.");
      }
    });

    listaProdutos.appendChild(card);
  });
}

/* ==========================================
   MODAL - NOVO PRODUTO
========================================== */

function abrirModalNovoProduto() {
  abrirModal(
    "Novo Produto",
    `
      <form id="formNovoProduto" class="form-grid">
        <div class="form-group">
          <label>Nome</label>
          <input type="text" id="nomeProduto" required>
        </div>

        <div class="form-group">
          <label>Preço</label>
          <input type="number" id="precoProduto" step="0.01" required>
        </div>

        <div class="form-group">
          <label>Categoria</label>
          <select id="categoriaProduto" required>
            <option value="">Selecione...</option>
            ${gerarOptionsCategoria()}
          </select>
        </div>

        <div class="form-group">
          <label>Imagem do produto</label>
          <input
            type="file"
            id="imagemProduto"
            accept="image/*"
          >
        </div>

        <div class="form-group form-group-full">
          <label>Preview da imagem</label>
          <div id="previewImagemProduto" class="produto-preview-box">
            <div class="produto-preview-empty">Sem imagem</div>
          </div>
        </div>

        <div class="form-group form-group-full">
          <label>Descrição</label>
          <textarea id="descricaoProduto"></textarea>
        </div>

        <div class="modal-actions">
          <button type="button" id="cancelarProduto" class="btn btn-secondary">
            Cancelar
          </button>

          <button type="submit" class="btn btn-primary">
            Salvar
          </button>
        </div>
      </form>
    `
  );

  document.getElementById("cancelarProduto")?.addEventListener("click", fecharModal);

  const imagemInput = document.getElementById("imagemProduto");
  const preview = document.getElementById("previewImagemProduto");

  imagemInput?.addEventListener("change", () => {
    const file = imagemInput.files?.[0] || null;
    renderPreviewFile(file, preview);
  });

  document.getElementById("formNovoProduto")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const imagemFile = imagemInput?.files?.[0] || null;

      await criarProduto({
        nome: document.getElementById("nomeProduto").value.trim(),
        preco: Number(document.getElementById("precoProduto").value || 0),
        categoria: document.getElementById("categoriaProduto").value.trim(),
        descricao: document.getElementById("descricaoProduto").value.trim(),
        imagemFile,
        vendas: 0,
        ativo: true
      });

      toast("Produto salvo com sucesso!");
      fecharModal();
    } catch (erro) {
      console.error(erro);
      toast("Erro ao salvar produto.");
    }
  });
}

/* ==========================================
   MODAL - EDITAR PRODUTO
========================================== */

function abrirModalEditarProduto(produto) {
  abrirModal(
    "Editar Produto",
    `
      <form id="formEditarProduto" class="form-grid">
        <div class="form-group">
          <label>Nome</label>
          <input
            type="text"
            id="editNomeProduto"
            value="${escapeHtml(produto.nome || "")}"
            required
          >
        </div>

        <div class="form-group">
          <label>Preço</label>
          <input
            type="number"
            id="editPrecoProduto"
            step="0.01"
            value="${Number(produto.preco || 0)}"
            required
          >
        </div>

        <div class="form-group">
          <label>Categoria</label>
          <select id="editCategoriaProduto" required>
            <option value="">Selecione...</option>
            ${gerarOptionsCategoria(produto.categoria || "")}
          </select>
        </div>

        <div class="form-group">
          <label>Trocar imagem</label>
          <input
            type="file"
            id="editImagemProduto"
            accept="image/*"
          >
        </div>

        <div class="form-group form-group-full">
          <label>Preview da imagem</label>
          <div id="previewEditImagemProduto" class="produto-preview-box">
            ${
              produto.imagem
                ? `<img src="${escapeHtml(produto.imagem)}" alt="Preview" class="produto-preview-img">`
                : `<div class="produto-preview-empty">Sem imagem</div>`
            }
          </div>
        </div>

        <div class="form-group form-group-full">
          <label>Descrição</label>
          <textarea id="editDescricaoProduto">${escapeHtml(produto.descricao || "")}</textarea>
        </div>

        <div class="modal-actions">
          <button type="button" id="cancelarEditarProduto" class="btn btn-secondary">
            Cancelar
          </button>

          <button type="submit" class="btn btn-primary">
            Salvar alterações
          </button>
        </div>
      </form>
    `
  );

  document.getElementById("cancelarEditarProduto")?.addEventListener("click", fecharModal);

  const editImagemInput = document.getElementById("editImagemProduto");
  const preview = document.getElementById("previewEditImagemProduto");

  editImagemInput?.addEventListener("change", () => {
    const file = editImagemInput.files?.[0] || null;
    if (file) renderPreviewFile(file, preview);
  });

  document.getElementById("formEditarProduto")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const imagemFile = editImagemInput?.files?.[0] || null;

      const payload = {
        nome: document.getElementById("editNomeProduto").value.trim(),
        preco: Number(document.getElementById("editPrecoProduto").value || 0),
        categoria: document.getElementById("editCategoriaProduto").value.trim(),
        descricao: document.getElementById("editDescricaoProduto").value.trim()
      };

      if (imagemFile) {
        payload.imagemFile = imagemFile;
      }

      await editarProduto(produto.id, payload);

      toast("Produto atualizado com sucesso!");
      fecharModal();
    } catch (erro) {
      console.error(erro);
      toast("Erro ao atualizar produto.");
    }
  });
}

initProdutos();