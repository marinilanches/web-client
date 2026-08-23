import { fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";
import { abrirDetalhesPedido } from "../components/pedido-detalhes.js";
import { renderBoard } from "../components/pedido-column.js";

import {
  ouvirPedidos,
  criarPedido,
  alterarStatus,
  cancelarPedido,
  marcarComoImpresso,
  excluirPedido,
} from "../../js/services/orders.js";

/* ==========================================
   ELEMENTOS
========================================== */

const listaPedidos = document.getElementById("listaPedidos");
const btnNovoPedido = document.getElementById("novoPedido");
const filtroStatus = document.getElementById("filtroStatus");
const filtroTipo = document.getElementById("filtroTipo");
const buscarPedido = document.getElementById("buscarPedido");

/* ==========================================
   ESTADO
========================================== */

let pedidosCache = [];

/* ==========================================
   INIT
========================================== */

console.log("pedidos.js carregado");

ouvirPedidos((pedidos) => {
  pedidosCache = pedidos;
  aplicarFiltros();
});

/* ==========================================
   FILTROS
========================================== */

filtroStatus?.addEventListener("change", aplicarFiltros);
filtroTipo?.addEventListener("change", aplicarFiltros);
buscarPedido?.addEventListener("input", aplicarFiltros);

function aplicarFiltros() {
  let pedidos = [...pedidosCache];

  pedidos = pedidos.filter(
    (p) => String(p.numeroPedido) !== "2600",
  );

  const status = filtroStatus?.value || "";
  const tipo = filtroTipo?.value || "";
  const busca =
    buscarPedido?.value?.trim().toLowerCase() || "";

  if (status) {
    pedidos = pedidos.filter(
      (p) => p.status === status,
    );
  }

  if (tipo) {
    pedidos = pedidos.filter(
      (p) => p.tipo === tipo,
    );
  }

  if (busca) {
    pedidos = pedidos.filter((p) => {
      return (
        (p.cliente || "")
          .toLowerCase()
          .includes(busca) ||

        (p.telefone || "")
          .toLowerCase()
          .includes(busca) ||

        String(p.numeroPedido || "")
          .includes(busca) ||

        (p.tipo || "")
          .toLowerCase()
          .includes(busca)
      );
    });
  }

  renderBoard(pedidos, {
    onDetalhes: abrirDetalhesPedido,
    onAcao: tratarAcaoPedido,
  });
}

/* ==========================================
   AÇÕES DOS PEDIDOS
========================================== */

async function tratarAcaoPedido(pedido) {
  try {
    switch (pedido.status) {
      case "RECEBIDO":
        await alterarStatus(
          pedido.id,
          "PREPARANDO",
        );

        if (!pedido.impresso) {
          await enviarParaImpressora(pedido);

          await marcarComoImpresso(
            pedido.id,
          );
        }

        toast("Pedido em preparo");
        break;

      case "PREPARANDO":
        await alterarStatus(
          pedido.id,
          "PRONTO",
        );

        toast("Pedido pronto");
        break;

      case "PRONTO":
        await alterarStatus(
          pedido.id,
          "SAIU_PARA_ENTREGA",
        );

        toast("Pedido saiu para entrega");
        break;
    }
  } catch (erro) {
    console.error(erro);
    toast("Erro ao atualizar pedido.");
  }
}

/* ==========================================
   NOVO PEDIDO
========================================== */

btnNovoPedido?.addEventListener("click", () => {
  abrirModal(
    "Novo Pedido",
    `
      <form id="formNovoPedido" class="form-grid">

        <div class="form-group">
          <label>Nome do cliente</label>
          <input type="text" id="cliente" required>
        </div>

        <div class="form-group">
          <label>Telefone</label>
          <input type="text" id="telefone">
        </div>

        <div class="form-group">
          <label>Tipo</label>

          <select id="tipoPedido">
            <option value="Delivery">Delivery</option>
            <option value="Retirada">Retirada</option>
            <option value="Mesa">Mesa</option>
          </select>
        </div>

        <div class="form-group">
          <label>Observações</label>
          <textarea id="observacoes"></textarea>
        </div>

        <div class="modal-actions">

          <button
            type="button"
            class="btn btn-secondary"
            id="cancelarPedido">
            Cancelar
          </button>

          <button
            type="submit"
            class="btn btn-primary">
            Salvar Pedido
          </button>

        </div>

      </form>
    `,
  );

  document
    .getElementById("cancelarPedido")
    ?.addEventListener(
      "click",
      fecharModal,
    );

  document
    .getElementById("formNovoPedido")
    ?.addEventListener(
      "submit",
      async (e) => {
        e.preventDefault();

        try {
          await criarPedido({
            cliente: document
              .getElementById("cliente")
              .value
              .trim(),

            telefone: document
              .getElementById("telefone")
              .value
              .trim(),

            tipo: document
              .getElementById("tipoPedido")
              .value,

            observacoes: document
              .getElementById("observacoes")
              .value
              .trim(),

            itens: [],
            valorTotal: 0,
            pagamentoStatus: "PENDENTE",
          });

          toast("Pedido criado com sucesso!");
          fecharModal();

        } catch (erro) {
          console.error(erro);
          toast("Erro ao criar pedido.");
        }
      },
    );
});

async function enviarParaImpressora(pedido) {
  console.log(
    "========== PEDIDO FIREBASE REAL ==========",
  );

  console.log(
    JSON.stringify(pedido, null, 2),
  );

  console.log(
    "==========================================",
  );

  try {
    const res = await fetch(
      "http://localhost:3002/print/order",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(pedido),
      },
    );

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    toast("Pedido enviado para impressora");

  } catch (erro) {
    console.error(
      "Erro impressão:",
      erro,
    );

    toast("Erro ao imprimir");
  }
}