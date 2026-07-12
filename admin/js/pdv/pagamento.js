// admin/js/pdv/pagamento.js


import {
    toast
} from "../components/toast.js";



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


export function initPagamento() {


    bindEventos();


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

        calcularTroco

    );


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


    const formasValidas = [


        "dinheiro",


        "pix",


        "credito",


        "debito"



    ];



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


    const recebido =


        Number(
            valorRecebido?.value || 0
        );



    pagamentoSelecionado.valorRecebido =
        recebido;



    pagamentoSelecionado.troco =


        Math.max(
            recebido - Number(total || 0),
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
        "dinheiro"
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
        "dinheiro"
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



    if (formaPagamento) {


        formaPagamento.value =
            "";


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