// admin/js/pdv/ui-carrinho.js

import {
    obterCarrinho,
    obterTaxaEntrega,
    totalCarrinho,
    quantidadeItensCarrinho,
    aumentarQuantidadeCarrinho,
    diminuirQuantidadeCarrinho,
    removerItemCarrinho
} from "./carrinho.js";

import {
getTaxaEntrega
}
from "./delivery.js";

/* ==========================================
   ELEMENTOS
========================================== */

const listaCarrinho =
    document.getElementById("listaCarrinho");

const subtotalCarrinho =
    document.getElementById("subtotalCarrinho");

const totalCarrinhoElemento =
    document.getElementById("totalCarrinho");

const taxaPDV =
    document.getElementById("taxaPDV");

const taxaElemento =
    document.getElementById("taxaPDV");

const quantidadeCarrinho =
    document.getElementById("quantidadeCarrinho");

/* ==========================================
   HELPERS
========================================== */

function formatarMoeda(valor) {

    return Number(valor || 0).toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );

}

/* ==========================================
   RENDER
========================================== */

export function atualizarCarrinhoUI() {

    if (!listaCarrinho) return;

    const carrinho = obterCarrinho();

    renderItens(carrinho);

    atualizarResumo();

    bindEventos();

}

/* ==========================================
   ITENS
========================================== */

function renderItens(carrinho) {

    if (!carrinho.length) {

        listaCarrinho.innerHTML = `

            <div class="empty-state">

                <h3>Carrinho vazio</h3>

                <p>
                    Adicione produtos para iniciar a venda.
                </p>

            </div>

        `;

        return;

    }

    listaCarrinho.innerHTML = carrinho
        .map(renderItemCarrinho)
        .join("");

}

/* ==========================================
   CARD ITEM
========================================== */

function renderItemCarrinho(item) {

    console.log("ITEM CARRINHO:", JSON.stringify(item,null,2));

    const adicionais = "";

    const personalizacoes = (item.personalizacoes || [])
        .map(p => `${p.grupo}: ${p.nome}`)
        .join("<br>");

    return `

        <div
            class="carrinho-item"
            data-id="${item.idCarrinho}">

            <div class="carrinho-info">

                <div class="carrinho-nome">

                    ${item.nome}

                </div>

                ${
                    personalizacoes
                    ?
                    `
                    <div class="carrinho-extra">

                        ${personalizacoes}

                    </div>
                    `
                    :
                    ""
                }

                ${
                    item.observacao
                    ?
                    `
                    <div class="carrinho-observacao">

                        📝 ${item.observacao}

                    </div>
                    `
                    :
                    ""
                }

                <div class="carrinho-preco">

                    ${formatarMoeda(item.valorUnitario)}

                </div>

            </div>

            <div class="carrinho-acoes">

                <button
                    class="btn-diminuir"
                    data-id="${item.idCarrinho}">

                    −

                </button>

                <span>

                    ${item.quantidade}

                </span>

                <button
                    class="btn-aumentar"
                    data-id="${item.idCarrinho}">

                    +

                </button>

            </div>

            <div class="carrinho-total">

                ${formatarMoeda(item.valorTotal)}

            </div>

            <button
                class="btn-remover"
                data-id="${item.idCarrinho}">

                🗑

            </button>

        </div>

    `;

}

/* ==========================================
   RESUMO
========================================== */

function atualizarResumo() {

    const total = totalCarrinho();

    const taxa =
        obterTaxaEntrega();

    const quantidade =
        quantidadeItensCarrinho();


    if(subtotalCarrinho){

        subtotalCarrinho.textContent =
            formatarMoeda(
                total - taxa
            );

    }


    if(taxaPDV){

        taxaPDV.textContent =
            formatarMoeda(taxa);

    }

    if(taxaElemento){

    taxaElemento.textContent =
    formatarMoeda(
    getTaxaEntrega()
    );

    }


    if(totalCarrinhoElemento){

        totalCarrinhoElemento.textContent =
            formatarMoeda(total);

    }


    if(quantidadeCarrinho){

        quantidadeCarrinho.textContent =
            quantidade;

    }

}

/* ==========================================
   EVENTOS
========================================== */

function bindEventos() {

    document
        .querySelectorAll(".btn-aumentar")
        .forEach(bindAumentar);

    document
        .querySelectorAll(".btn-diminuir")
        .forEach(bindDiminuir);

    document
        .querySelectorAll(".btn-remover")
        .forEach(bindRemover);

}

function bindAumentar(botao) {

    botao.onclick = () => {

        aumentarQuantidadeCarrinho(
            botao.dataset.id
        );

    };

}

function bindDiminuir(botao) {

    botao.onclick = () => {

        diminuirQuantidadeCarrinho(
            botao.dataset.id
        );

    };

}

function bindRemover(botao) {

    botao.onclick = () => {

        removerItemCarrinho(
            botao.dataset.id
        );

    };

}