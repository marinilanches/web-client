// admin/js/pdv/produtos.js

import { abrirModal, fecharModal } from "../../components/modal.js";
import { toast } from "../../components/toast.js";

import {
    ouvirProdutos
} from "../../../js/services/products.js";

import {
    listarAdicionais
} from "../../../js/services/additionals.js";

import {
    adicionarItemCarrinho
} from "./carrinho.js";

/* ==========================================
   ELEMENTOS
========================================== */

const listaProdutos = document.getElementById("listaProdutosPDV");

const buscarProduto = document.getElementById("buscarProdutoPDV");

const categoriaProduto = document.getElementById("categoriaPDV");

/* ==========================================
   ESTADO
========================================== */

let produtosCache = [];

let produtosFiltrados = [];

let categoriasCache = [];

let adicionaisCache = [];

let produtoSelecionado = null;

/* ==========================================
   INIT
========================================== */

export async function initProdutosPDV() {

    console.log("produtos.js carregado");

    await carregarAdicionais();

    ouvirProdutos((produtos) => {

        produtosCache = produtos.filter(
            (produto) => produto.ativo !== false
        );

        carregarCategorias();

        aplicarFiltros();

    });

    bindEventos();

}

/* ==========================================
   EVENTOS
========================================== */

function bindEventos() {

    buscarProduto?.addEventListener(
        "input",
        aplicarFiltros
    );

    categoriaProduto?.addEventListener(
        "change",
        aplicarFiltros
    );

}

/* ==========================================
   ADICIONAIS
========================================== */

async function carregarAdicionais() {

    try {

        adicionaisCache = await listarAdicionais();

    } catch (erro) {

        console.error(erro);

        toast(
            "Erro ao carregar adicionais."
        );

    }

}

/* ==========================================
   CATEGORIAS
========================================== */

function carregarCategorias() {

    categoriasCache = [
        ...new Set(
            produtosCache
                .map(produto => produto.categoria)
                .filter(Boolean)
        )
    ].sort(
        (a, b) => a.localeCompare(b, "pt-BR")
    );

    if (!categoriaProduto) return;

    categoriaProduto.innerHTML = `
        <option value="">
            Todas categorias
        </option>
    `;

    categoriasCache.forEach((categoria) => {

        categoriaProduto.insertAdjacentHTML(
            "beforeend",
            `
            <option value="${categoria}">
                ${categoria}
            </option>
            `
        );

    });

}

/* ==========================================
   FILTROS
========================================== */

function aplicarFiltros() {

    const termo =
        buscarProduto?.value
            ?.trim()
            .toLowerCase() || "";

    const categoria =
        categoriaProduto?.value || "";

    produtosFiltrados = produtosCache.filter((produto) => {

        const nome =
            (produto.nome || "")
                .toLowerCase();

        const descricao =
            (produto.descricao || "")
                .toLowerCase();

        const categoriaProduto =
            produto.categoria || "";

        const pesquisaOK =

            nome.includes(termo) ||

            descricao.includes(termo);

        const categoriaOK =

            !categoria ||

            categoriaProduto === categoria;

        return pesquisaOK && categoriaOK;

    });

    renderProdutos();

}

/* ==========================================
   RENDER PRODUTOS
========================================== */

function renderProdutos() {

    if (!listaProdutos) return;

    if (!produtosFiltrados.length) {

        listaProdutos.innerHTML = `
            <div class="empty-state">

                <h3>
                    Nenhum produto encontrado
                </h3>

                <p>
                    Tente alterar os filtros.
                </p>

            </div>
        `;

        return;

    }

    listaProdutos.innerHTML = "";

    produtosFiltrados.forEach((produto) => {

        listaProdutos.appendChild(
            criarCardProduto(produto)
        );

    });

    bindBotoesAdicionar();

}

/* ==========================================
   CARD PRODUTO
========================================== */

function criarCardProduto(produto) {

    const card = document.createElement("div");

    card.className = "panel pdv-card";

    card.innerHTML = `

        <div class="pdv-card-imagem">

            ${
                produto.imagem
                ?

                `
                <img
                    src="${produto.imagem}"
                    alt="${produto.nome}"
                    loading="lazy"
                >
                `

                :

                `
                <div class="pdv-sem-imagem">

                    🍔

                </div>
                `
            }

        </div>

        <div class="pdv-card-conteudo">

            <span class="pdv-categoria">

                ${produto.categoria || "Sem categoria"}

            </span>

            <h3>

                ${produto.nome}

            </h3>

            <p>

                ${produto.descricao || ""}

            </p>

            <div class="pdv-card-footer">

                <strong>

                    ${formatarMoeda(produto.preco)}

                </strong>

                <button
                    class="btn btn-primary btn-add-produto"
                    data-id="${produto.id}">

                    ➕

                    Adicionar

                </button>

            </div>

        </div>

    `;

    return card;

}

/* ==========================================
   BOTÕES
========================================== */

function bindBotoesAdicionar() {

    document
        .querySelectorAll(".btn-add-produto")
        .forEach((botao) => {

            botao.addEventListener(
                "click",
                () => {

                    const produto = produtosCache.find(

                        item => item.id === botao.dataset.id

                    );

                    if (!produto) {

                        toast(
                            "Produto não encontrado."
                        );

                        return;

                    }

                    abrirProduto(produto);

                }
            );

        });

}

/* ==========================================
   HELPERS
========================================== */

function formatarMoeda(valor = 0) {

    return Number(valor).toLocaleString(

        "pt-BR",

        {

            style: "currency",

            currency: "BRL"

        }

    );

}

/* ==========================================
   MODAL PRODUTO
========================================== */

function abrirProduto(produto) {

    produtoSelecionado = structuredClone(produto);

    abrirModal(
        produto.nome,
        montarModalProduto(produto)
    );

    bindModalProduto();

    atualizarTotalProduto();

}

function montarModalProduto(produto) {

    return `

        <div class="pdv-modal-produto">

            ${renderImagemProduto(produto)}

            <h2>

                ${produto.nome}

            </h2>

            <p>

                ${produto.descricao || ""}

            </p>

            ${renderGrupos(produto)}

            ${renderAdicionais()}

            <div class="form-group">

                <label>

                    Observação

                </label>

                <textarea
                    id="observacaoProduto"
                    rows="3"
                    placeholder="Ex.: sem cebola"
                ></textarea>

            </div>

            <div class="pdv-quantidade">

                <button
                    id="menosQuantidade"
                    class="btn btn-secondary">

                    −

                </button>

                <span id="quantidadeProduto">

                    1

                </span>

                <button
                    id="maisQuantidade"
                    class="btn btn-secondary">

                    +

                </button>

            </div>

            <hr>

            <div class="pdv-total-item">

                Total

                <strong id="valorProduto">

                    ${formatarMoeda(produto.preco)}

                </strong>

            </div>

            <div class="modal-actions">

                <button
                    id="cancelarProduto"
                    class="btn btn-secondary">

                    Cancelar

                </button>

                <button
                    id="confirmarProduto"
                    class="btn btn-primary">

                    Adicionar ao Carrinho

                </button>

            </div>

        </div>

    `;

}

function renderImagemProduto(produto){

    if(!produto.imagem){

        return `

            <div class="pdv-sem-imagem">

                🍔

            </div>

        `;

    }

    return `

        <img
            src="${produto.imagem}"
            class="pdv-modal-imagem"
            alt="${produto.nome}"
        >

    `;

}

function renderGrupos(produto){

    if(
        !produto.gruposPersonalizacao ||
        !produto.gruposPersonalizacao.length
    ){
        return "";
    }

    return produto.gruposPersonalizacao.map((grupo)=>{

        return `

            <div class="form-group">

                <label>

                    ${grupo.nome}

                </label>

                ${grupo.opcoes.map((opcao)=>`

                    <label class="checkbox">

                        ${opcao.nome}

                        ${
                            Number(opcao.preco || 0) > 0
                            ?
                            `(+ ${formatarMoeda(opcao.preco)})`
                            :
                            ""
                        }

                    </label>

                `).join("")}

            </div>

        `;

    }).join("");

}

function renderAdicionais(){

    if(!adicionaisCache.length){

        return "";

    }

    return `

        <div class="form-group">

            <label>

                Adicionais

            </label>

            ${adicionaisCache.map((adicional)=>`

                <label class="checkbox">

                    <input
                        type="checkbox"
                        class="adicional-item"
                        data-id="${adicional.id}"
                        data-nome="${adicional.nome}"
                        data-preco="${adicional.preco}"
                    >

                    ${adicional.nome}

                    ${
                        Number(adicional.preco || 0) > 0
                        ?
                        `(+ ${formatarMoeda(adicional.preco)})`
                        :
                        ""
                    }

                </label>

            `).join("")}

        </div>

    `;

}

function bindModalProduto(){

    document
        .getElementById("cancelarProduto")
        ?.addEventListener(
            "click",
            fecharModal
        );

    document
        .getElementById("maisQuantidade")
        ?.addEventListener(
            "click",
            aumentarQuantidade
        );

    document
        .getElementById("menosQuantidade")
        ?.addEventListener(
            "click",
            diminuirQuantidade
        );

    document
        .querySelectorAll(
            ".grupo-personalizacao,.adicional-item"
        )
        .forEach((input)=>{

            input.addEventListener(
                "change",
                atualizarTotalProduto
            );

        });

    document
        .getElementById("confirmarProduto")
        ?.addEventListener(
            "click",
            confirmarProduto
        );

}

/* ==========================================
   QUANTIDADE
========================================== */

function obterQuantidadeAtual() {

    const elemento = document.getElementById("quantidadeProduto");

    return Number(elemento?.textContent || 1);

}

function definirQuantidade(valor) {

    const elemento = document.getElementById("quantidadeProduto");

    if (!elemento) return;

    elemento.textContent = Math.max(1, valor);

}

function aumentarQuantidade() {

    const quantidade = obterQuantidadeAtual();

    definirQuantidade(quantidade + 1);

    atualizarTotalProduto();

}

function diminuirQuantidade() {

    const quantidade = obterQuantidadeAtual();

    if (quantidade <= 1) return;

    definirQuantidade(quantidade - 1);

    atualizarTotalProduto();

}

/* ==========================================
   TOTAL DO ITEM
========================================== */

function atualizarTotalProduto() {

    if (!produtoSelecionado) return;

    const quantidade = obterQuantidadeAtual();

    let total = Number(produtoSelecionado.preco || 0);

    document
        .querySelectorAll(".grupo-personalizacao:checked")
        .forEach((input) => {

            total += Number(input.dataset.preco || 0);

        });

    document
        .querySelectorAll(".adicional-item:checked")
        .forEach((input) => {

            total += Number(input.dataset.preco || 0);

        });

    total *= quantidade;

    const valor = document.getElementById("valorProduto");

    if (valor) {

        valor.textContent = formatarMoeda(total);

    }

}

/* ==========================================
   CONFIRMAR PRODUTO
========================================== */

function confirmarProduto() {

    if (!produtoSelecionado) return;

    const quantidade = obterQuantidadeAtual();

    const personalizacoes = [];

    document
        .querySelectorAll(".grupo-personalizacao:checked")
        .forEach((input) => {

            personalizacoes.push({

                grupo: input.dataset.grupo,

                nome: input.dataset.nome,

                preco: Number(input.dataset.preco || 0)

            });

        });

    const adicionais = [];

    document
        .querySelectorAll(".adicional-item:checked")
        .forEach((input) => {

            adicionais.push({

                id: input.dataset.id,

                nome: input.dataset.nome,

                preco: Number(input.dataset.preco || 0)

            });

        });

    const observacao = document
        .getElementById("observacaoProduto")
        ?.value
        ?.trim() || "";

    const valorAdicionais = adicionais.reduce(

        (total, item) => total + Number(item.preco || 0),

        0

    );

    const valorPersonalizacao = personalizacoes.reduce(

        (total, item) => total + Number(item.preco || 0),

        0

    );

    const valorUnitario =
        Number(produtoSelecionado.preco || 0) +
        valorAdicionais +
        valorPersonalizacao;

    adicionarItemCarrinho({

        produtoId: produtoSelecionado.id,

        nome: produtoSelecionado.nome,

        imagem: produtoSelecionado.imagem || "",

        categoria: produtoSelecionado.categoria || "",

        quantidade,

        valorUnitario,

        valorTotal: valorUnitario * quantidade,

        adicionais,

        personalizacoes,

        observacao

    });

    toast("Produto adicionado ao carrinho.");

    fecharModal();

}