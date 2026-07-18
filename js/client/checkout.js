import { carregarFormasPagamento } from "../services/payments.js";

/* ==========================================================
   CHECKOUT DO CLIENTE
   O INDEX APENAS REDIRECIONA APÓS VALIDAÇÕES
========================================================== */

export function irParaCheckout() {
  window.location.href = "./pedido.html";
}


/* ==========================================================
   INICIAR CHECKOUT
========================================================== */

export async function iniciarCheckout() {
  // O controle dos botões Finalizar Pedido
  // é feito pelo app.js
}