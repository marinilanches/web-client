// admin/js/pdv/mesa.js


import {
    ouvirMesas
} from "../../js/services/tables.js";


import {
    toast
} from "../components/toast.js";



/* ==========================================================
   ELEMENTOS
========================================================== */


const selectMesa =
    document.getElementById("mesaPDV");



/* ==========================================================
   ESTADO
========================================================== */


let mesasCache = [];


let mesaSelecionada = null;



/* ==========================================================
   INIT
========================================================== */


export function initMesa() {


    bindEventos();


    carregarMesas();


}



/* ==========================================================
   CARREGAR MESAS
========================================================== */


export function carregarMesas() {


    try {


        ouvirMesas((mesas) => {

            mesasCache = ordenarMesas(mesas);
        
            atualizarSelectMesas();
        
        });


    } catch (erro) {


        console.error(erro);


        toast(
            "Erro ao carregar mesas."
        );


    }


}



/* ==========================================================
   ATUALIZAR SELECT
========================================================== */


function atualizarSelectMesas() {


    const mesaAtual =
        mesaSelecionada?.id || "";


    renderMesas();



    if (
        mesaAtual &&
        [...selectMesa.options]
            .some(
                option =>
                    option.value === mesaAtual
            )
    ) {


        selectMesa.value =
            mesaAtual;


    }


}



/* ==========================================================
   RENDER
========================================================== */


function renderMesas() {


    if (!selectMesa) return;


    const valorAtual =
        selectMesa.value;



    selectMesa.innerHTML = "";



    adicionarOpcaoSemMesa();



    mesasCache.forEach((mesa) => {


        selectMesa.appendChild(
            criarOptionMesa(mesa)
        );


    });



    if (
        valorAtual &&
        [...selectMesa.options]
            .some(
                option =>
                    option.value === valorAtual
            )
    ) {


        selectMesa.value =
            valorAtual;


    }


}



/* ==========================================================
   OPTIONS
========================================================== */


function adicionarOpcaoSemMesa() {


    const option =
        document.createElement("option");


    option.value = "";


    option.textContent =
        "Sem Mesa";


    selectMesa.appendChild(option);


}



/* ==========================================================
   CRIAR OPTION
========================================================== */


function criarOptionMesa(mesa) {


    const option =
        document.createElement("option");


    option.value =
        mesa.id;



    const numero =
        mesa.numero || "-";



        const ocupada =
            mesa.status === "OCUPADA";
    
        const status =
            ocupada
                ? "🔴"
                : "🟢";



    option.textContent =
        `${status} Mesa ${numero}`;



        option.disabled =
            ocupada;



    return option;


}



/* ==========================================================
   EVENTOS
========================================================== */


function bindEventos() {


    selectMesa?.addEventListener(

        "change",

        onChangeMesa

    );


}



function onChangeMesa() {


    const id =
        selectMesa.value;



    if (!id) {


        limparMesa();


        return;


    }



    selecionarMesaPorId(id);


}



/* ==========================================================
   SELEÇÃO
========================================================== */


function selecionarMesa(id) {


    const mesa =
        buscarMesaPorId(id);



    if (!mesa) {


        limparMesa();


        return;


    }



    mesaSelecionada =
        mesa;



}



export function selecionarMesaPorId(id) {


    if (!id) {


        limparMesa();


        return;


    }



    const mesa =
        buscarMesaPorId(id);



    if (!mesa) {


        toast(
            "Mesa não encontrada."
        );


        limparMesa();


        return;


    }



    mesaSelecionada =
        mesa;



    if (selectMesa) {


        selectMesa.value =
            id;


    }


}



/* ==========================================================
   RESET
========================================================== */


export function limparMesa() {


    mesaSelecionada =
        null;



    if (selectMesa) {


        selectMesa.value =
            "";


    }


}



/* ==========================================================
   GETTERS
========================================================== */


export function getMesaSelecionada() {


    return mesaSelecionada;


}



export function getMesaId() {


    return mesaSelecionada?.id || null;


}



export function getNumeroMesa() {


    return mesaSelecionada?.numero || "";


}



export function possuiMesaSelecionada() {


    return mesaSelecionada !== null;


}



/* ==========================================================
   CACHE
========================================================== */


export function getMesas() {


    return [
        ...mesasCache
    ];


}



export function atualizarMesas() {


    carregarMesas();


}



/* ==========================================================
   HELPERS
========================================================== */


function buscarMesaPorId(id) {


    return mesasCache.find(

        mesa =>
            mesa.id === id

    ) || null;


}



function ordenarMesas(mesas = []) {


    return [
        ...mesas
    ].sort((a, b) => {


        return Number(a.numero || 0)
            -
            Number(b.numero || 0);


    });


}