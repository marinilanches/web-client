import { criarPedido } from "../services/orders.js";

import {
    getCarrinho,
    getTotal,
    limparCarrinho
} from "./cart.js";

/* ==========================================================
   FINALIZAR PEDIDO
========================================================== */

export async function finalizarPedido() {

    const itens = getCarrinho();
    const tipoPedido = document.getElementById("tipoPedido")?.value || "Delivery";

    if (itens.length === 0) {
        alert("Carrinho vazio.");
        return;
    }

    try {

        await criarPedido({
            cliente: "",
            telefone: "",
            tipo: tipoPedido,
            clienteId: null,
            mesaId: null,
            itens,
            observacoes: "",
            valorTotal: getTotal(),
            pagamentoMetodo: "",
            pagamentoStatus: "PENDENTE"
        });

        alert("Pedido enviado com sucesso!");

        limparCarrinho();

        window.location.href = "/status.html";

    } catch (erro) {

        console.error("Erro ao finalizar pedido:", erro);
        alert("Não foi possível finalizar o pedido.");

    }

}

/* ==========================================================
   INICIAR CHECKOUT
========================================================== */

export function iniciarCheckout() {

    const btn = document.getElementById("finalizarBtn");

    if (!btn) return;

    btn.addEventListener(

        "click",

        finalizarPedido

    );

}