/* ==========================================================
   CHECKOUT DO CLIENTE
   NO INDEX.HTML NÃO FINALIZA O PEDIDO:
   APENAS REDIRECIONA PARA pedido.html
========================================================== */

export function irParaCheckout() {
    // se não tiver carrinho salvo, o pedido.html ainda valida depois
    window.location.href = "./pedido.html";
}

/* ==========================================================
   INICIAR CHECKOUT
========================================================== */

export function iniciarCheckout() {
    const btn =
        document.getElementById("finalizarBtn") ||
        document.getElementById("btnFinalizar");

    if (!btn) return;

    btn.addEventListener("click", irParaCheckout);
}