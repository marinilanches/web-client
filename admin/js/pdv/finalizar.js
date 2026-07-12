// admin/js/pdv/finalizar.js


import {
    validarPedido,
    montarPedido,
    limparPedido
} from "./pedido.js";


import {
    limparCarrinho
} from "./carrinho.js";


import {
    limparCliente
} from "./cliente.js";


import {
    limparMesa
} from "./mesa.js";


import {
    limparDelivery
} from "./delivery.js";

import {
    limparTipoPedido
} from "./tipoPedido.js";


import {
    limparPagamento
} from "./pagamento.js";


import {
    limparDesconto
} from "./desconto.js";


import {
    criarPedido
} from "../../js/services/orders.js";


import {
    toast
} from "../components/toast.js";



/* ==========================================================
   ELEMENTOS
========================================================== */


const btnFinalizar =
    document.getElementById("btnFinalizarVenda");



/* ==========================================================
   INIT
========================================================== */


export function initFinalizar() {


    bindEventos();


}



/* ==========================================================
   EVENTOS
========================================================== */


function bindEventos() {


    btnFinalizar?.addEventListener(

        "click",

        finalizarPedido

    );


}



/* ==========================================================
   FINALIZAR PEDIDO
========================================================== */


export async function finalizarPedido() {


    try {


        const valido =
            validarPedido();



        if (!valido) {


            return;


        }



        const pedido =
            montarPedido();



        if (!pedido) {


            toast(
                "Erro ao montar pedido."
            );


            return;


        }



        const referencia =
            await salvarPedido(
                pedido
            );



        toast(
            "Pedido criado com sucesso!"
        );



        prepararImpressao(
            {
                ...pedido,
                id: referencia.id
            }
        );



        limparPDV();



    } catch (erro) {


        console.error(erro);


        toast(
            "Erro ao finalizar pedido."
        );


    }


}



/* ==========================================================
   SALVAR PEDIDO
========================================================== */


async function salvarPedido(pedido) {

    return criarPedido(pedido);

}



/* ==========================================================
   LIMPAR PDV
========================================================== */


function limparPDV() {


    limparCarrinho();


    limparCliente();


    limparMesa();


    limparDelivery();

    limparTipoPedido();


    limparPagamento();


    limparDesconto();


    limparPedido();


}



/* ==========================================================
   IMPRESSÃO
========================================================== */


function prepararImpressao(pedido) {


    console.log(
        "Preparar impressão da comanda:",
        pedido
    );


}



/* ==========================================================
   ATUALIZAÇÃO EXTERNA
========================================================== */


export function atualizarFinalizacao() {


    bindEventos();


}