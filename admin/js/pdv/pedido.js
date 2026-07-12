// admin/js/pdv/pedido.js


import {
    getClienteSelecionado,
    getClienteId
} from "./cliente.js";


import {
    getMesaSelecionada,
    getMesaId
} from "./mesa.js";


import {
    getEnderecoEntrega,
    validarEntrega
} from "./delivery.js";

import {
    getTipoPedido,
    isDelivery,
    isMesa
} from "./tipoPedido.js";


import {
    obterCarrinho,
    totalCarrinho
} from "./carrinho.js";


import {
    getDesconto,
    calcularTotalComDesconto,
    validarDesconto
} from "./desconto.js";


import {
    getPagamento,
    validarPagamento
} from "./pagamento.js";


import {
    toast
} from "../components/toast.js";



/* ==========================================================
   ESTADO
========================================================== */


let pedidoAtual = null;



/* ==========================================================
   MONTAR PEDIDO
========================================================== */


export function montarPedido() {


    const carrinho =
        obterCarrinho();



    const subtotal =
        totalCarrinho();



    const total =
        calcularTotalComDesconto(
            subtotal
        );



    const desconto =
        getDesconto();



    const pedido = {


        clienteId:
            getClienteId(),



        cliente:
            obterDadosCliente(),



        mesaId:
            getMesaId(),



        mesa:
            obterDadosMesa(),



        entrega:
            montarEntrega(),



        itens:
            carrinho,



        subtotal,



        desconto,



        total,



        pagamento:
            getPagamento(),



        status:
            "aberto",



        criadoEm:
            new Date()



    };



    pedidoAtual =
        pedido;



    return pedido;



}



/* ==========================================================
   VALIDAÇÃO
========================================================== */


export function validarPedido() {


    const carrinho =
        obterCarrinho();



    if (
        !carrinho.length
    ) {


        toast(
            "Adicione produtos ao pedido."
        );


        return false;


    }



    if (
        isDelivery() &&
        !validarEntrega()
    ) {
    
        return false;
    
    }

    if (
        isMesa() &&
        !getMesaId()
    ) {
    
        toast(
            "Selecione uma mesa."
        );
    
        return false;
    
    }



    if (
        !validarDesconto()
    ) {


        return false;


    }



    const total =
        calcularTotalComDesconto(
            totalCarrinho()
        );



    if (
        !validarPagamento(total)
    ) {


        return false;


    }



    return true;


}



/* ==========================================================
   CLIENTE
========================================================== */


function obterDadosCliente() {


    const cliente =
        getClienteSelecionado();



    if (!cliente) {


        return null;


    }



    return {


        id:
            cliente.id,


        nome:
            cliente.nome,


        telefone:
            cliente.telefone || ""


    };


}



/* ==========================================================
   MESA
========================================================== */


function obterDadosMesa() {


    const mesa =
        getMesaSelecionada();



    if (!mesa) {


        return null;


    }



    return {


        id:
            mesa.id,


        numero:
            mesa.numero


    };


}



/* ==========================================================
   ENTREGA
========================================================== */


function montarEntrega() {

    return {

        tipo: getTipoPedido(),

        endereco: getEnderecoEntrega()

    };

}



/* ==========================================================
   GETTERS
========================================================== */


export function getPedidoAtual() {


    return pedidoAtual;


}



export function possuiPedidoAtual() {


    return pedidoAtual !== null;


}



/* ==========================================================
   RESET
========================================================== */


export function limparPedido() {


    pedidoAtual =
        null;


}



/* ==========================================================
   RECRIAR PEDIDO
========================================================== */


export function atualizarPedido() {


    pedidoAtual =
        montarPedido();



    return pedidoAtual;


}