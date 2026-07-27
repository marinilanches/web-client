import { criarCardPedido } from "./pedido-card.js";

const mapas = {
  RECEBIDO: {
    body: "colunaRecebidos",
    contador: "contadorRecebidos",
  },

  PREPARANDO: {
    body: "colunaPreparando",
    contador: "contadorPreparando",
  },

  PRONTO: {
    body: "colunaProntos",
    contador: "contadorProntos",
  },

  ENTREGUE: {
    body: "colunaEntregues",
    contador: "contadorEntregues",
  },
};

export function limparBoard() {
  Object.values(mapas).forEach((coluna) => {
    const body = document.getElementById(coluna.body);

    if (body) {
      body.innerHTML = "";
    }

    const contador = document.getElementById(coluna.contador);

    if (contador) {
      contador.textContent = "0";
    }
  });
}

export function renderizarColuna(status, pedidos, eventos = {}) {
  const config = mapas[status];

  if (!config) return;

  const body = document.getElementById(config.body);

  const contador = document.getElementById(config.contador);

  if (!body) return;

  body.innerHTML = "";

  contador.textContent = pedidos.length;

  if (!pedidos.length) {
    body.innerHTML = `
            <div class="pedido-vazio">
                Nenhum pedido
            </div>
        `;

    return;
  }

  pedidos.forEach((pedido) => {
    body.appendChild(
      criarCardPedido(pedido, eventos),
    );
  });
}

export function renderBoard(pedidos, eventos = {}) {
  limparBoard();

  renderizarColuna(
    "RECEBIDO",
    pedidos.filter((p) => p.status === "RECEBIDO"),
    eventos,
  );

  renderizarColuna(
    "PREPARANDO",
    pedidos.filter((p) => p.status === "PREPARANDO"),
    eventos,
  );

  renderizarColuna(
    "PRONTO",
    pedidos.filter((p) => p.status === "PRONTO"),
    eventos,
  );

  renderizarColuna(
    "ENTREGUE",
    pedidos.filter((p) => p.status === "ENTREGUE"),
    eventos,
  );
}