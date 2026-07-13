// admin/js/pdv/pdv.js


import {
    initCliente
} from "./cliente.js";


import {
    initMesa
} from "./mesa.js";


import {
    initDelivery
} from "./delivery.js";

import {
    initTipoPedido
} from "./tipoPedido.js";


import {
    initPagamento
} from "./pagamento.js";


import {
    initDesconto
} from "./desconto.js";


import {
    initProdutosPDV
} from "./produtos.js";


import {
    initFinalizar
} from "./finalizar.js";


import { toast } from "../../components/toast.js";



/* ==========================================================
   INIT PDV
========================================================== */


export async function initPDV() {


    try {


        console.log(
            "PDV inicializando..."
        );

        initCliente();

        initTipoPedido();

        initMesa();



        initDelivery();



        initPagamento();



        initDesconto();



        await initProdutosPDV();



        initFinalizar();



        console.log(
            "PDV carregado com sucesso."
        );



    } catch (erro) {


        console.error(erro);



        toast(
            "Erro ao carregar o PDV."
        );


    }


}



/* ==========================================================
   EVENTOS GLOBAIS
========================================================== */


function bindEventosGlobais() {


    document.addEventListener(

        "keydown",

        tratarAtalhos

    );


}



/* ==========================================================
   ATALHOS
========================================================== */


function tratarAtalhos(evento) {


    /*
        Reservado para atalhos futuros:

        F2  -> novo cliente

        F3  -> buscar produto

        F4  -> finalizar pedido

        ESC -> fechar modal


    */


}



/* ==========================================================
   RESET GERAL
========================================================== */


export function resetPDV() {


    console.log(
        "Reset geral do PDV."
    );


}



/* ==========================================================
   BOOT
========================================================== */

bindEventosGlobais();

initPDV();