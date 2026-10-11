import { criarCardPedido } from "./pedido-card.js";

const mapas = {
  RECEBIDO: { body: "colunaRecebidos", contador: "contadorRecebidos" },
  PREPARANDO: { body: "colunaPreparando", contador: "contadorPreparando" },
  PRONTO: { body: "colunaProntos", contador: "contadorProntos" },
  SAIU_PARA_ENTREGA: { body: "colunaSaiuParaEntrega", contador: "contadorSaiuParaEntrega" },
  ENTREGUE: { body: "colunaEntregues", contador: "contadorEntregues" },
};

export function limparBoard() {
  Object.values(mapas).forEach((coluna) => {
    const body = document.getElementById(coluna.body);
    if (body) body.innerHTML = "";
    const contador = document.getElementById(coluna.contador);
    if (contador) contador.textContent = "0";
  });
}

export function renderizarColuna(status, pedidos, eventos = {}) {
  const config = mapas[status];
  if (!config) return;

  const body = document.getElementById(config.body);
  const contador = document.getElementById(config.contador);
  if (!body) return;

  body.innerHTML = "";
  if (contador) contador.textContent = pedidos.length;

  if (!pedidos.length) {
    body.innerHTML = `<div class="pedido-vazio">Nenhum pedido</div>`;
    return;
  }

  pedidos.forEach((pedido) => body.appendChild(criarCardPedido(pedido, eventos)));
}

export function renderBoard(pedidos, eventos = {}) {
  limparBoard();
  Object.keys(mapas).forEach((status) => {
    renderizarColuna(status, pedidos.filter((pedido) => pedido.status === status), eventos);
  });
}
