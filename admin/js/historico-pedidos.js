import {
  buscarPedidosPorPeriodo,
  excluirPedido,
} from "../../js/services/orders.js";

import { abrirDetalhesPedido } from "../components/pedido-detalhes.js";

import { toast } from "../components/toast.js";

const dataInicial = document.getElementById("dataInicial");

const dataFinal = document.getElementById("dataFinal");

const filtroStatus = document.getElementById("filtroStatus");

const buscarPedido = document.getElementById("buscarPedido");

const btnBuscar = document.getElementById("buscarPedidos");

const listaHistorico = document.getElementById("listaHistorico");

let pedidosCache = [];

/* ==========================================
   PERÍODO PADRÃO - ÚLTIMA SEMANA
========================================== */

function definirUltimaSemana() {
  const hoje = new Date();

  const semanaAtras = new Date();

  semanaAtras.setDate(hoje.getDate() - 7);

  dataInicial.value = semanaAtras.toISOString().split("T")[0];

  dataFinal.value = hoje.toISOString().split("T")[0];
}

definirUltimaSemana();

carregarHistorico();

btnBuscar?.addEventListener("click", carregarHistorico);

async function carregarHistorico() {
  const inicio = dataInicial.value;

  const fim = dataFinal.value;

  if (!inicio || !fim) {
    toast("Informe o período");

    return;
  }

  try {
    const pedidos = await buscarPedidosPorPeriodo(inicio, fim);

    pedidosCache = pedidos;

    aplicarFiltros();
  } catch (erro) {
    console.error("Erro ao carregar histórico:", erro);

    toast("Erro ao buscar pedidos.");
  }
}

filtroStatus?.addEventListener("change", aplicarFiltros);

buscarPedido?.addEventListener("input", aplicarFiltros);

function aplicarFiltros() {
  let pedidos = [...pedidosCache];

  pedidos.sort((a, b) => {
    const dataA = a.criadoEm?.seconds || 0;

    const dataB = b.criadoEm?.seconds || 0;

    return dataB - dataA;
  });

  const status = filtroStatus?.value || "";

  const termo = buscarPedido?.value.trim().toLowerCase() || "";

  if (status) {
    pedidos = pedidos.filter((pedido) => pedido.status === status);
  }

  if (termo) {
    pedidos = pedidos.filter((pedido) => {
      const cliente = (pedido.cliente || "").toLowerCase();

      const telefone = (pedido.telefone || "").toLowerCase();

      const numero = String(pedido.numeroPedido || "");

      return (
        cliente.includes(termo) ||
        telefone.includes(termo) ||
        numero.includes(termo)
      );
    });
  }

  renderPedidos(pedidos);
}

function renderPedidos(pedidos) {
  if (!listaHistorico) return;

  if (!pedidos.length) {
    listaHistorico.innerHTML = `

      <div class="empty-state">

        <h3>

          Nenhum pedido encontrado

        </h3>


        <p>

          Não existem pedidos neste período.

        </p>


      </div>

    `;

    return;
  }

  listaHistorico.innerHTML = pedidos
    .map((pedido) => {
      const dataPedido = pedido.criadoEm
        ? new Date(pedido.criadoEm.seconds * 1000)
        : null;

      return `


    <div class="panel">


        <div class="panel-title">

            Pedido #

            ${pedido.numeroPedido || pedido.id.slice(0, 6)}

        </div>


        <p>

    <strong>📅 Data:</strong>

    ${dataPedido ? dataPedido.toLocaleDateString("pt-BR") : "-"}

</p>


<p>

    <strong>🕒 Horário:</strong>

    ${
      dataPedido
        ? dataPedido.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-"
    }

</p>



      <p>

        <strong>

        Cliente:

        </strong>

        ${pedido.cliente || "-"}

      </p>



      <p>

        <strong>

        Status:

        </strong>

        ${pedido.status || "-"}

      </p>




      <p>

        <strong>

        Tipo:

        </strong>

        ${pedido.tipo || "-"}

      </p>




      <p>

        <strong>

        Total:

        </strong>

        R$

        ${Number(pedido.valorTotal || 0).toFixed(2)}


      </p>



        <div class="modal-actions">


            <button
                class="btn btn-secondary btn-detalhes"
                data-id="${pedido.id}">
                🔎 Detalhes
            </button>


            <button
                class="btn btn-primary btn-repetir"
                data-id="${pedido.id}">
                🔁 Repetir Pedido
            </button>


            <button
                class="btn btn-danger btn-excluir"
                data-id="${pedido.id}">
                🗑️ Excluir Pedido
            </button>


        </div>



        </div>


    `;
    })
    .join("");

  document.querySelectorAll(".btn-detalhes").forEach((btn) => {
    btn.onclick = () => {
      const pedido = pedidosCache.find((p) => p.id === btn.dataset.id);

      abrirDetalhesPedido(pedido);
    };
  });

  document.querySelectorAll(".btn-repetir").forEach((btn) => {
    btn.onclick = () => {
      toast("Repetir pedido será integrado ao PDV.");
    };
  });

  document.querySelectorAll(".btn-excluir").forEach((btn) => {
    btn.onclick = async () => {
      const confirmar = confirm(
        "Deseja realmente excluir este pedido do histórico?",
      );

      if (!confirmar) {
        return;
      }

      try {
        await excluirPedido(btn.dataset.id);

        toast("Pedido excluído com sucesso.");

        carregarHistorico();
      } catch (erro) {
        console.error("Erro ao excluir pedido:", erro);

        toast("Erro ao excluir pedido.");
      }
    };
  });
}
