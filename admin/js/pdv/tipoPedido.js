// admin/js/pdv/tipoPedido.js

import {
    toast
} from "../components/toast.js";

/* ==========================================================
   ELEMENTOS
========================================================== */

const selectTipoPedido =
    document.getElementById("tipoPedidoPDV");

const containerMesa =
    document.getElementById("containerMesa");

const containerTaxa =
    document.getElementById("containerTaxa");

/* ==========================================================
   ESTADO
========================================================== */

let tipoPedido = "RETIRADA";

/* ==========================================================
   INIT
========================================================== */

export function initTipoPedido() {

    bindEventos();

    atualizarInterface();

}

/* ==========================================================
   EVENTOS
========================================================== */

function bindEventos() {

    selectTipoPedido?.addEventListener(

        "change",

        alterarTipoPedido

    );

}

function alterarTipoPedido() {

    selecionarTipoPedido(
        selectTipoPedido.value
    );

}

/* ==========================================================
   TIPO
========================================================== */

export function selecionarTipoPedido(tipo) {

    const tipos = [

        "RETIRADA",

        "DELIVERY",

        "MESA"

    ];

    if (!tipos.includes(tipo)) {

        toast("Tipo de pedido inválido.");

        return;

    }

    tipoPedido = tipo;

    atualizarInterface();

}

/* ==========================================================
   INTERFACE
========================================================== */

function atualizarInterface() {

    if (containerMesa) {

        containerMesa.style.display =

            tipoPedido === "MESA"
                ? "block"
                : "none";

    }

    if (containerTaxa) {

        containerTaxa.style.display =

            tipoPedido === "DELIVERY"
                ? "block"
                : "none";

    }

}

/* ==========================================================
   GETTERS
========================================================== */

export function getTipoPedido() {

    return tipoPedido;

}

export function isMesa() {

    return tipoPedido === "MESA";

}

export function isDelivery() {

    return tipoPedido === "DELIVERY";

}

export function isRetirada() {

    return tipoPedido === "RETIRADA";

}

/* ==========================================================
   RESET
========================================================== */

export function limparTipoPedido() {

    tipoPedido = "RETIRADA";

    if (selectTipoPedido) {

        selectTipoPedido.value =
            "RETIRADA";

    }

    atualizarInterface();

}