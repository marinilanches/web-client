// admin/js/pdv/desconto.js


import {
    toast
} from "../components/toast.js";



/* ==========================================================
   ELEMENTOS
========================================================== */


const tipoDesconto =
    document.getElementById("tipoDescontoPDV");


const valorDesconto =
    document.getElementById("valorDescontoPDV");



/* ==========================================================
   ESTADO
========================================================== */


let descontoAtual = {


    tipo: "",


    valor: 0



};



/* ==========================================================
   INIT
========================================================== */


export function initDesconto() {


    bindEventos();


}



/* ==========================================================
   EVENTOS
========================================================== */


function bindEventos() {


    tipoDesconto?.addEventListener(

        "change",

        atualizarTipoDesconto

    );


    valorDesconto?.addEventListener(

        "input",

        atualizarValorDesconto

    );


}



/* ==========================================================
   TIPO
========================================================== */


function atualizarTipoDesconto() {


    selecionarTipoDesconto(
        tipoDesconto.value
    );


}



export function selecionarTipoDesconto(tipo) {


    const tiposValidos = [


        "percentual",


        "valor"



    ];



    if (
        tipo === ""
    ) {


        descontoAtual = {


            tipo: "",


            valor: 0


        };


        return;


    }



    if (
        !tiposValidos.includes(tipo)
    ) {


        toast(
            "Tipo de desconto inválido."
        );


        return;


    }



    descontoAtual.tipo =
        tipo;



}



/* ==========================================================
   VALOR
========================================================== */


function atualizarValorDesconto() {


    definirValorDesconto(
        valorDesconto.value
    );


}



export function definirValorDesconto(valor) {


    descontoAtual.valor =
        Number(valor || 0);



}



/* ==========================================================
   APLICAR
========================================================== */


export function aplicarDesconto(tipo, valor) {


    if (tipo) {


        selecionarTipoDesconto(tipo);


    }



    if (valor !== undefined) {


        definirValorDesconto(valor);


    }



    if (
        descontoAtual.valor <= 0
    ) {


        toast(
            "Informe um desconto válido."
        );


        return false;


    }



    return true;


}



/* ==========================================================
   REMOVER
========================================================== */


export function removerDesconto() {


    descontoAtual = {


        tipo: "",


        valor: 0


    };



    limparCampos();



}



/* ==========================================================
   CALCULO
========================================================== */


export function calcularDesconto(total = 0) {


    const valorTotal =
        Number(total || 0);



    if (
        !descontoAtual.tipo ||
        descontoAtual.valor <= 0
    ) {


        return 0;


    }



    if (
        descontoAtual.tipo ===
        "percentual"
    ) {


        return (

            valorTotal *
            descontoAtual.valor /
            100

        );


    }



    return Math.min(

        descontoAtual.valor,

        valorTotal

    );


}



export function calcularTotalComDesconto(total = 0) {


    const desconto =
        calcularDesconto(total);



    return Math.max(

        Number(total || 0) - desconto,

        0

    );


}



/* ==========================================================
   VALIDAÇÃO
========================================================== */


export function validarDesconto() {


    if (
        !descontoAtual.tipo
    ) {


        return true;


    }



    if (
        descontoAtual.valor <= 0
    ) {


        toast(
            "Desconto inválido."
        );


        return false;


    }



    return true;


}



/* ==========================================================
   GETTERS
========================================================== */


export function getDesconto() {


    return {


        ...descontoAtual


    };


}



export function getValorDesconto(total = 0) {


    return calcularDesconto(total);


}



export function possuiDesconto() {


    return (

        descontoAtual.tipo !== "" &&

        descontoAtual.valor > 0

    );


}



/* ==========================================================
   RESET
========================================================== */


export function limparDesconto() {


    descontoAtual = {


        tipo: "",


        valor: 0


    };



    limparCampos();



}



/* ==========================================================
   CAMPOS
========================================================== */


function limparCampos() {


    if (tipoDesconto) {


        tipoDesconto.value =
            "";


    }



    if (valorDesconto) {


        valorDesconto.value =
            "";


    }


}



/* ==========================================================
   ATUALIZAÇÃO EXTERNA
========================================================== */


export function atualizarDesconto() {


    atualizarTipoDesconto();


    atualizarValorDesconto();


}