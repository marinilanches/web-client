import { ouvirPedidosPorPeriodo } from "../../js/services/orders.js";

let pedidosCache = [];

const faturamentoTotal = document.getElementById("faturamentoTotal");
const pedidosPagos = document.getElementById("pedidosPagos");
const ticketMedio = document.getElementById("ticketMedio");
const caixaAtual = document.getElementById("caixaAtual");

const listaFinanceiro = document.getElementById("listaFinanceiro");

const formaPagamento = document.getElementById("formaPagamento");
const btnAtualizar = document.getElementById("btnAtualizar");

let filtroPagamento = "";

/*
==========================================
INICIALIZAÇÃO
==========================================
*/

carregarFinanceiro();

async function carregarFinanceiro() {
  const inicio = document.getElementById("dataInicio").value;

  const fim = document.getElementById("dataFim").value;

  const hoje = new Date();

  const dataInicio = inicio ? new Date(inicio) : hoje;

  const dataFim = fim ? new Date(fim) : hoje;

  ouvirPedidosPorPeriodo(dataInicio, dataFim, (pedidos) => {
    pedidosCache = pedidos;

    atualizarFinanceiro();
  });
}

btnAtualizar?.addEventListener("click", () => {
  filtroPagamento = formaPagamento.value;

  carregarFinanceiro();
});

/*
==========================================
PROCESSAMENTO
==========================================
*/

function atualizarFinanceiro() {
  let pedidos = [...pedidosCache];

  if (filtroPagamento) {
    pedidos = pedidos.filter(
      (pedido) =>
        String(pedido.pagamentoMetodo).toUpperCase() ===
        filtroPagamento.toUpperCase(),
    );
  }

  const pagos = pedidos.filter(
    (pedido) =>
      pedido.pagamentoStatus === "PAGO" || pedido.status === "ENTREGUE",
  );

  const faturamento = pagos.reduce(
    (total, pedido) => total + Number(pedido.valorTotal || 0),
    0,
  );

  const ticket = pagos.length ? faturamento / pagos.length : 0;

  faturamentoTotal.textContent = formatarMoeda(faturamento);

  pedidosPagos.textContent = pagos.length;

  ticketMedio.textContent = formatarMoeda(ticket);

  caixaAtual.textContent = formatarMoeda(faturamento);

  renderTabela(pagos);

  renderGraficoPagamentos(pagos);

  renderGraficoFaturamento(pagos);
}

/*
==========================================
TABELA
==========================================
*/

function renderTabela(pedidos) {
  if (!listaFinanceiro) return;

  if (!pedidos.length) {
    listaFinanceiro.innerHTML = `
            <tr>
                <td colspan="7">
                    Nenhum pedido encontrado
                </td>
            </tr>
        `;

    return;
  }

  listaFinanceiro.innerHTML = pedidos
    .map(
      (pedido) => `

        <tr>

            <td>
                #${pedido.numeroPedido || "-"}
            </td>

            <td>
                ${pedido.cliente || "-"}
            </td>

            <td>
                ${pedido.pagamentoMetodo || "-"}
            </td>

            <td>
                ${formatarMoeda(pedido.valorTotal)}
            </td>

            <td>
                ${pedido.status}
            </td>

            <td>
                ${formatarData(pedido.criadoEm)}
            </td>

            <td>
                -
            </td>

        </tr>


    `,
    )
    .join("");
}

/*
==========================================
GRÁFICO PAGAMENTOS
==========================================
*/

function renderGraficoPagamentos(pedidos) {
  const canvas = document.getElementById("graficoPagamentos");

  if (!canvas || !window.Chart) return;

  const valores = {};

  pedidos.forEach((pedido) => {
    const metodo = pedido.pagamentoMetodo || "OUTROS";

    valores[metodo] = (valores[metodo] || 0) + Number(pedido.valorTotal || 0);
  });

  if (canvas.chart) canvas.chart.destroy();

  canvas.chart = new Chart(canvas, {
    type: "doughnut",

    data: {
      labels: Object.keys(valores),

      datasets: [
        {
          data: Object.values(valores),
        },
      ],
    },
  });
}

/*
==========================================
GRÁFICO EVOLUÇÃO FATURAMENTO
==========================================
*/

function renderGraficoFaturamento(pedidos) {
  const canvas = document.getElementById("graficoFaturamento");

  if (!canvas || !window.Chart) return;

  const dias = {};

  pedidos.forEach((pedido) => {
    let data = pedido.criadoEm;

    if (data?.toDate) {
      data = data.toDate();
    }

    if (!data) return;

    const dia = new Date(data).toLocaleDateString("pt-BR");

    dias[dia] = (dias[dia] || 0) + Number(pedido.valorTotal || 0);
  });

  if (canvas.chart) canvas.chart.destroy();

  canvas.chart = new Chart(canvas, {
    type: "line",

    data: {
      labels: Object.keys(dias),

      datasets: [
        {
          label: "Faturamento",

          data: Object.values(dias),

          tension: 0.3,
        },
      ],
    },

    options: {
      responsive: true,

      plugins: {
        legend: {
          display: true,
        },
      },

      scales: {
        y: {
          ticks: {
            callback: (valor) => "R$ " + valor.toFixed(2),
          },
        },
      },
    },
  });
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(data) {
  if (!data) return "-";

  if (data.toDate) {
    data = data.toDate();
  }

  return new Date(data).toLocaleDateString("pt-BR");
}
