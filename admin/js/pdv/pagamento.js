// admin/js/pdv/pagamento.js


import {
    toast
} from "../../components/toast.js";

import {
    doc,
    getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../../../js/services/firebase.js";



/* ==========================================================
   ELEMENTOS
========================================================== */


const formaPagamento =
    document.getElementById("formaPagamentoPDV");


const valorRecebido =
    document.getElementById("valorRecebidoPDV");



const campoTroco =
    document.getElementById("trocoPDV");



/* ==========================================================
   ESTADO
========================================================== */


let pagamentoSelecionado = {


    forma: "",


    valorRecebido: 0,


    troco: 0



};



/* ==========================================================
   INIT
========================================================== */


export async function initPagamento() {

    bindEventos();

    await carregarFormasPagamentoPDV();

    atualizarInterface();

}



/* ==========================================================
   EVENTOS
========================================================== */


function bindEventos() {

    formaPagamento?.addEventListener(
        "change",
        alterarFormaPagamento
    );

    valorRecebido?.addEventListener(
        "input",
        atualizarValorRecebido
    );

}

function atualizarValorRecebido() {

    pagamentoSelecionado.valorRecebido =
        Number(valorRecebido?.value || 0);

}



/* ==========================================================
   FORMA PAGAMENTO
========================================================== */


function alterarFormaPagamento() {


    selecionarFormaPagamento(
        formaPagamento.value
    );


}



export function selecionarFormaPagamento(forma) {


    forma = String(forma || "")
        .toUpperCase();


    const formasValidas = Array.from(
        formaPagamento.options
    ).map((option) => option.value.toUpperCase());


    if (
        !formasValidas.includes(forma)
    ) {


        toast(
            "Forma de pagamento inválida."
        );


        return;


    }


    pagamentoSelecionado.forma =
        forma;


    atualizarInterface();


}



/* ==========================================================
   VALOR RECEBIDO
========================================================== */


export function definirValorRecebido(valor) {


    pagamentoSelecionado.valorRecebido =
        Number(valor || 0);



}



/* ==========================================================
   TROCO
========================================================== */


export function calcularTroco(total = 0) {

    pagamentoSelecionado.troco =
        Math.max(
            pagamentoSelecionado.valorRecebido - Number(total || 0),
            0
        );

    atualizarTrocoVisual();

    return pagamentoSelecionado.troco;

}



function atualizarTrocoVisual() {


    if (!campoTroco) return;



    campoTroco.textContent =


        formatarMoeda(
            pagamentoSelecionado.troco
        );



}



/* ==========================================================
   INTERFACE
========================================================== */


function atualizarInterface() {


    if (!valorRecebido) return;



    if (
        pagamentoSelecionado.forma ===
        "DINHEIRO"
    ) {


        valorRecebido.disabled =
            false;



    } else {


        valorRecebido.disabled =
            true;



        valorRecebido.value =
            "";



        pagamentoSelecionado.valorRecebido =
            0;



        pagamentoSelecionado.troco =
            0;



    }



    atualizarTrocoVisual();



}

async function carregarFormasPagamentoPDV() {
    if (!formaPagamento) return;

    try {
        const snap = await getDoc(
            doc(db, "configuracoes", "geral")
        );

        if (!snap.exists()) return;

        const configuracao = snap.data();
        const pagamentos = Array.isArray(configuracao.pagamentos)
            ? configuracao.pagamentos
            : [];

        formaPagamento.innerHTML = "";

        pagamentos
            .filter((pagamento) => pagamento.ativo)
            .forEach((pagamento) => {
                const option = document.createElement("option");

                option.value = pagamento.id.toUpperCase();
                option.textContent = pagamento.nome;

                formaPagamento.appendChild(option);
            });

        if (formaPagamento.options.length > 0) {
            selecionarFormaPagamento(
                formaPagamento.options[0].value
            );
        }
    } catch (erro) {
        console.error(
            "Erro ao carregar formas de pagamento:",
            erro
        );
    }
}



/* ==========================================================
   VALIDAÇÃO
========================================================== */


export function validarPagamento(total = 0) {


    if (
        !pagamentoSelecionado.forma
    ) {


        toast(
            "Selecione uma forma de pagamento."
        );


        return false;


    }



    if (
        pagamentoSelecionado.forma ===
        "DINHEIRO"
    ) {


        if (
            pagamentoSelecionado.valorRecebido
            <
            Number(total || 0)
        ) {


            toast(
                "Valor recebido insuficiente."
            );


            return false;


        }


    }



    return true;



}



/* ==========================================================
   GETTERS
========================================================== */


export function getPagamento() {


    return {


        ...pagamentoSelecionado


    };


}



export function getFormaPagamento() {


    return pagamentoSelecionado.forma;


}



export function getValorRecebido() {


    return pagamentoSelecionado.valorRecebido;


}



export function getTroco() {


    return pagamentoSelecionado.troco;


}



/* ==========================================================
   RESET
========================================================== */


export function limparPagamento() {


    pagamentoSelecionado = {


        forma: "",


        valorRecebido: 0,


        troco: 0


    };



    if (formaPagamento && formaPagamento.options.length) {
        formaPagamento.selectedIndex = 0;

        pagamentoSelecionado.forma =
            formaPagamento.value.toUpperCase();
    }



    if (valorRecebido) {


        valorRecebido.value =
            "";


    }



    atualizarInterface();



}



/* ==========================================================
   HELPERS
========================================================== */


function formatarMoeda(valor = 0) {


    return Number(valor)
        .toLocaleString(

            "pt-BR",

            {

                style: "currency",

                currency: "BRL"

            }

        );


}