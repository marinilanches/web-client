import { abrirModal, fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

import {
    ouvirProdutos,
    criarProduto
} from "../../js/services/products.js";

/* ==========================================
   ELEMENTOS
========================================== */

let listaProdutos;
let btnNovoProduto;
let buscarProduto;

let produtosCache = [];

function initProdutos() {
    listaProdutos = document.getElementById("listaProdutos");
    btnNovoProduto = document.getElementById("novoProduto");
    buscarProduto = document.getElementById("buscarProduto");

    console.log("produtos.js carregado");

    ouvirProdutos((produtos) => {
        produtosCache = produtos;
        aplicarFiltros();
    });

    buscarProduto?.addEventListener("input", aplicarFiltros);

    btnNovoProduto?.addEventListener("click", abrirModalNovoProduto);
}

/* ==========================================
   FILTROS
========================================== */

function aplicarFiltros() {

    let produtos = [...produtosCache];
    const termo = buscarProduto?.value?.trim().toLowerCase() || "";

    if (termo) {
        produtos = produtos.filter((produto) => {
            const nome = (produto.nome || "").toLowerCase();
            const descricao = (produto.descricao || "").toLowerCase();
            const categoria = (produto.categoria || "").toLowerCase();

            return (
                nome.includes(termo) ||
                descricao.includes(termo) ||
                categoria.includes(termo)
            );
        });
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
        card.className = "panel";

        card.innerHTML = `
            <div class="panel-title">
                ${produto.nome || "Produto sem nome"}
            </div>

            <p>
                <strong>Preço:</strong>
                R$ ${Number(produto.preco || 0).toFixed(2)}
            </p>

            <p>
                <strong>Categoria:</strong>
                ${produto.categoria || "-"}
            </p>

            <p>
                <strong>Descrição:</strong>
                ${produto.descricao || "-"}
            </p>

            <p>
                <strong>Vendas:</strong>
                ${produto.vendas ?? 0}
            </p>
        `;

        listaProdutos.appendChild(card);

    });

}

/* ==========================================
   NOVO PRODUTO
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
                <input type="text" id="categoriaProduto">
            </div>

            <div class="form-group">
                <label>Descrição</label>
                <textarea id="descricaoProduto"></textarea>
            </div>

            <div class="modal-actions">
                <button
                    type="button"
                    id="cancelarProduto"
                    class="btn btn-secondary">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="btn btn-primary">
                    Salvar
                </button>
            </div>

        </form>
        `
    );

    document
        .getElementById("cancelarProduto")
        ?.addEventListener("click", fecharModal);

    document
        .getElementById("formNovoProduto")
        ?.addEventListener("submit", async (e) => {

            e.preventDefault();

            try {

                await criarProduto({
                    nome: document.getElementById("nomeProduto").value.trim(),
                    preco: document.getElementById("precoProduto").value,
                    categoria: document.getElementById("categoriaProduto").value.trim(),
                    descricao: document.getElementById("descricaoProduto").value.trim(),
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

initProdutos();