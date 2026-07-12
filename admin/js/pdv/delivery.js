// admin/js/pdv/delivery.js


import {
    toast
} from "../components/toast.js";

import {
    isDelivery
} from "./tipoPedido.js";



/* ==========================================================
   ELEMENTOS
========================================================== */


const campoEndereco =
    document.getElementById("enderecoEntregaPDV");



/* ==========================================================
   ESTADO
========================================================== */


let enderecoEntrega = {

    rua: "",

    numero: "",

    bairro: "",

    complemento: "",

    referencia: ""

};



/* ==========================================================
   INIT
========================================================== */


export function initDelivery() {


    bindEventos();


    atualizarInterface();


}



/* ==========================================================
   EVENTOS
========================================================== */


function bindEventos() {

}



/* ==========================================================
   INTERFACE
========================================================== */


function atualizarInterface() {

    if (!campoEndereco) return;

    campoEndereco.style.display =
        isDelivery()
            ? "block"
            : "none";

}



/* ==========================================================
   ENDEREÇO
========================================================== */


export function definirEnderecoEntrega(dados = {}) {


    enderecoEntrega = {


        rua:
            dados.rua || "",


        numero:
            dados.numero || "",


        bairro:
            dados.bairro || "",


        complemento:
            dados.complemento || "",


        referencia:
            dados.referencia || ""


    };


}



export function limparEnderecoEntrega() {


    enderecoEntrega = {


        rua: "",


        numero: "",


        bairro: "",


        complemento: "",


        referencia: ""


    };


}



/* ==========================================================
   GETTERS
========================================================== */


export function getTipoEntrega() {


    return entregaSelecionada;


}



export function getEnderecoEntrega() {


    return {
        ...enderecoEntrega
    };


}



export function possuiEntrega() {

    return isDelivery();

}



/* ==========================================================
   VALIDAÇÃO
========================================================== */


export function validarEntrega() {


    if (!isDelivery()) {

        return true;
    
    }



    const possuiEndereco =


        enderecoEntrega.rua &&
        enderecoEntrega.numero &&
        enderecoEntrega.bairro;



    if (!possuiEndereco) {


        toast(
            "Informe o endereço de entrega."
        );


        return false;


    }



    return true;


}



/* ==========================================================
   RESET
========================================================== */


export function limparDelivery() {

    limparEnderecoEntrega();

    atualizarInterface();

}



/* ==========================================================
   ATUALIZAÇÃO EXTERNA
========================================================== */


export function atualizarDelivery() {


    atualizarInterface();


}