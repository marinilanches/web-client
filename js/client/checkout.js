/* ==========================================================
   CHECKOUT DO CLIENTE
   NO INDEX.HTML NÃO FINALIZA O PEDIDO:
   APENAS REDIRECIONA PARA pedido.html
========================================================== */

function obterTipoPedidoSelecionado() {
  const tipoDesktop = document.getElementById("tipoPedido");
  const tipoMobile = document.getElementById("tipoPedidoMobile");

  return (
    tipoDesktop?.value ||
    tipoMobile?.value ||
    localStorage.getItem("tipoPedido") ||
    "Delivery"
  );
}


export function irParaCheckout() {

  const tipoPedido = obterTipoPedidoSelecionado();

  localStorage.setItem(
    "tipoPedido",
    tipoPedido
  );


  window.location.href = "./pedido.html";
}


/* ==========================================================
   INICIAR CHECKOUT
========================================================== */

export function iniciarCheckout() {

  const btnDesktop =
    document.getElementById("finalizarBtn");


  const btnMobile =
    document.getElementById("finalizarBtnMobile");



  if (btnDesktop) {

    btnDesktop.addEventListener(
      "click",
      irParaCheckout
    );

  }



  if (btnMobile) {

    btnMobile.addEventListener(
      "click",
      irParaCheckout
    );

  }

}