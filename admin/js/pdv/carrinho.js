// admin/js/pdv/carrinho.js

import { atualizarCarrinhoUI } from "./ui-carrinho.js";

/* ==========================================
   ESTADO
========================================== */

let taxaEntrega = 0;

let carrinho = [];

/* ==========================================
   GETTERS
========================================== */

export function obterCarrinho() {

    return structuredClone(carrinho);

}

export function obterTaxaEntrega(){

    return taxaEntrega;

}

export function quantidadeItensCarrinho() {

    return carrinho.reduce(
        (total, item) => total + Number(item.quantidade || 0),
        0
    );

}

export function totalCarrinho() {

    return carrinho.reduce(
        (total, item) =>
            total + Number(item.valorTotal || 0),
        0
    );

}


export function totalComEntrega() {

    return totalCarrinho() + taxaEntrega;

}

/* ==========================================
   ADICIONAR ITEM
========================================== */

export function adicionarItemCarrinho(item) {

    carrinho.push({

        ...item,

        idCarrinho: crypto.randomUUID()

    });

    atualizarCarrinhoUI();

}

/* ==========================================
   REMOVER ITEM
========================================== */

export function removerItemCarrinho(idCarrinho) {

    carrinho = carrinho.filter(

        item => item.idCarrinho !== idCarrinho

    );

    atualizarCarrinhoUI();

}

/* ==========================================
   ALTERAR QUANTIDADE
========================================== */

export function alterarQuantidadeCarrinho(idCarrinho, quantidade) {

    const item = carrinho.find(

        item => item.idCarrinho === idCarrinho

    );

    if (!item) return;

    quantidade = Number(quantidade);

    if (quantidade <= 0) {

        removerItemCarrinho(idCarrinho);

        return;

    }

    item.quantidade = quantidade;

    item.valorTotal = item.valorUnitario * quantidade;

    atualizarCarrinhoUI();

}

/* ==========================================
   AUMENTAR
========================================== */

export function aumentarQuantidadeCarrinho(idCarrinho) {

    const item = carrinho.find(

        item => item.idCarrinho === idCarrinho

    );

    if (!item) return;

    alterarQuantidadeCarrinho(

        idCarrinho,

        item.quantidade + 1

    );

}

/* ==========================================
   DIMINUIR
========================================== */

export function diminuirQuantidadeCarrinho(idCarrinho) {

    const item = carrinho.find(

        item => item.idCarrinho === idCarrinho

    );

    if (!item) return;

    alterarQuantidadeCarrinho(

        idCarrinho,

        item.quantidade - 1

    );

}

export function definirTaxaEntrega(valor){

    taxaEntrega = Number(valor || 0);

    atualizarCarrinhoUI();

}

/* ==========================================
   LIMPAR
========================================== */

export function limparCarrinho() {

    carrinho = [];

    taxaEntrega = 0;

    atualizarCarrinhoUI();

}

/* ==========================================
   OBSERVAÇÃO
========================================== */

export function alterarObservacaoCarrinho(idCarrinho, observacao) {

    const item = carrinho.find(

        item => item.idCarrinho === idCarrinho

    );

    if (!item) return;

    item.observacao = observacao;

    atualizarCarrinhoUI();

}