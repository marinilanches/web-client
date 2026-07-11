import { initProdutosPDV } from "./pdv/produtos.js";
import { initCarrinhoPDV } from "./pdv/carrinho.js";
import { initClientesPDV } from "./pdv/clientes.js";
import { initMesasPDV } from "./pdv/mesas.js";
import { initPagamentoPDV } from "./pdv/pagamento.js";
import { initTotaisPDV } from "./pdv/totais.js";
import { initPesquisaPDV } from "./pdv/pesquisa.js";
import { initPedidoPDV } from "./pdv/pedido.js";

/* ==========================================
   MESA FÁCIL
   PDV
========================================== */

console.log("pdv.js carregado");

/* ==========================================
   INIT
========================================== */

document.addEventListener("DOMContentLoaded", async () => {

    try {

        await initCarrinhoPDV();

        await initProdutosPDV();

        await initClientesPDV();

        await initMesasPDV();

        await initPesquisaPDV();

        await initPagamentoPDV();

        await initTotaisPDV();

        await initPedidoPDV();

        console.log("PDV iniciado.");

    } catch (erro) {

        console.error("Erro ao iniciar o PDV:", erro);

    }

});