// admin/js/pdv/delivery.js


import {
    toast
} from "../../components/toast.js";

import {
    isDelivery,
    getTipoPedido
} from "./tipoPedido.js";

import {
    ouvirTaxasEntrega,
    listarTaxasEntregaAtivas
} from "../../../js/services/delivery-fees.js";

import {
    definirTaxaEntrega
} from "./carrinho.js";

import {
 getEnderecoCliente
} from "./cliente.js";



/* ==========================================================
   ELEMENTOS
========================================================== */


const campoEndereco =
    document.getElementById("enderecoEntregaPDV");

const selectBairro =
    document.getElementById("bairroPDV");

const campoRua =
    document.getElementById("ruaPDV");


const campoNumero =
    document.getElementById("numeroPDV");


const campoComplemento =
    document.getElementById("complementoPDV");


const campoReferencia =
    document.getElementById("referenciaPDV");



/* ==========================================================
   ESTADO
========================================================== */

let taxasEntregaCache = [];

let taxaEntregaAtual=0;


export async function carregarTaxaBairro(){

    const taxas =
        await listarTaxasEntregaAtivas();


    const taxa =
        taxas.find(
            item =>
            item.nome.toLowerCase()
            ===
            enderecoEntrega.bairro.toLowerCase()
        );


    taxaEntregaAtual =
        taxa?.taxa || 0;


    return taxaEntregaAtual;

}



export function getTaxaEntrega(){

    return taxaEntregaAtual;

}

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

    carregarBairros();

}



/* ==========================================================
   EVENTOS
========================================================== */


function bindEventos() {


    selectBairro?.addEventListener(
        "change",
        selecionarBairro
    );


    campoRua?.addEventListener(
        "input",
        atualizarEndereco
    );


    campoNumero?.addEventListener(
        "input",
        atualizarEndereco
    );


    campoComplemento?.addEventListener(
        "input",
        atualizarEndereco
    );


    campoReferencia?.addEventListener(
        "input",
        atualizarEndereco
    );


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

function atualizarEndereco(){

    enderecoEntrega.rua =
        campoRua?.value || "";


    enderecoEntrega.numero =
        campoNumero?.value || "";


    enderecoEntrega.complemento =
        campoComplemento?.value || "";


    enderecoEntrega.referencia =
        campoReferencia?.value || "";


}

/* ==========================================================
   BAIRROS
========================================================== */

function carregarBairros(){

    ouvirTaxasEntrega((taxas)=>{

        taxasEntregaCache =
            taxas.filter(
                item => item.ativo !== false
            );


        if(!selectBairro) return;


        selectBairro.innerHTML = `

            <option value="">
                Selecione o bairro
            </option>

        `;


        taxasEntregaCache.forEach((bairro)=>{


            selectBairro.insertAdjacentHTML(
                "beforeend",
                `

                <option
                    value="${bairro.nome}"
                    data-taxa="${bairro.taxa}"
                >

                    ${bairro.nome}

                </option>

                `
            );


        });


    });


}

function selecionarBairro(){

    const opcao =
        selectBairro.options[
            selectBairro.selectedIndex
        ];

    if(!opcao) return;

    enderecoEntrega.bairro = opcao.value;

    const taxa = Number(
        opcao.dataset.taxa || 0
    );

    taxaEntregaAtual = taxa;

    definirTaxaEntrega(taxa);
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

    if(campoRua)
        campoRua.value="";

    if(campoNumero)
        campoNumero.value="";

    if(campoComplemento)
        campoComplemento.value="";

    if(campoReferencia)
        campoReferencia.value="";

    if(selectBairro)
        selectBairro.value="";


}



/* ==========================================================
   GETTERS
========================================================== */



export function getEnderecoEntrega() {


    return {
        ...enderecoEntrega
    };


}



export function possuiEntrega() {

    return isDelivery();

}

export function preencherEnderecoCliente(){

    const endereco =
        getEnderecoCliente();


    if(!endereco){

        return;

    }


    enderecoEntrega={

        rua:endereco.rua || "",

        numero:endereco.numero || "",

        bairro:endereco.bairro || "",

        complemento:endereco.complemento || ""

    };


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