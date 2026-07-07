import { abrirModal, fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

import {
    ouvirPedidos,
    criarPedido,
    alterarStatus,
    cancelarPedido
} from "../../js/services/orders.js";

/* ==========================================
   ELEMENTOS
========================================== */

const listaPedidos = document.getElementById("listaPedidos");
const btnNovoPedido = document.getElementById("novoPedido");
const filtroStatus = document.getElementById("filtroStatus");
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
buscarPedido?.addEventListener("input", aplicarFiltros);

function aplicarFiltros() {
    let pedidos = [...pedidosCache];

    const statusSelecionado = filtroStatus?.value?.trim() || "";
    const termoBusca = buscarPedido?.value?.trim().toLowerCase() || "";

    if (statusSelecionado) {
        pedidos = pedidos.filter((p) => p.status === statusSelecionado);
    }

    if (termoBusca) {
        pedidos = pedidos.filter((p) => {
            const cliente = (p.cliente || "").toLowerCase();
            const telefone = (p.telefone || "").toLowerCase();
            const tipo = (p.tipo || "").toLowerCase();

            return (
                cliente.includes(termoBusca) ||
                telefone.includes(termoBusca) ||
                tipo.includes(termoBusca)
            );
        });
    }

    renderPedidos(pedidos);
}

/* ==========================================
   RENDER PEDIDOS
========================================== */

function renderPedidos(pedidos) {
    if (!listaPedidos) return;

    if (!pedidos.length) {
        listaPedidos.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum pedido encontrado</h3>
                <p>Os pedidos aparecerão aqui automaticamente.</p>
            </div>
        `;
        return;
    }

    listaPedidos.innerHTML = "";

    pedidos.forEach((pedido) => {
        const card = document.createElement("div");
        card.className = "panel";

        card.innerHTML = `
            <div class="panel-title">
                ${pedido.cliente || "Cliente sem nome"}
            </div>

            <p>
                <strong>Status:</strong>
                ${pedido.status || "-"}
            </p>

            <p>
                <strong>Telefone:</strong>
                ${pedido.telefone || "-"}
            </p>

            <p>
                <strong>Tipo:</strong>
                ${pedido.tipo || "-"}
            </p>

            <p>
                <strong>Total:</strong>
                R$ ${Number(pedido.valorTotal || 0).toFixed(2)}
            </p>

            <p>
                <strong>Observações:</strong>
                ${pedido.observacoes || "-"}
            </p>

            <div class="modal-actions pedido-actions">
                <button class="btn btn-secondary btn-preparando" data-id="${pedido.id}">
                    👨‍🍳 Preparando
                </button>

                <button class="btn btn-primary btn-pronto" data-id="${pedido.id}">
                    ✅ Pronto
                </button>

                <button class="btn btn-primary btn-entregue" data-id="${pedido.id}">
                    🚚 Entregue
                </button>

                <button class="btn btn-danger btn-cancelar" data-id="${pedido.id}">
                    ❌ Cancelar
                </button>
            </div>
        `;

        listaPedidos.appendChild(card);
    });

    bindAcoesPedidos();
}

/* ==========================================
   AÇÕES DOS PEDIDOS
========================================== */

function bindAcoesPedidos() {
    document.querySelectorAll(".btn-preparando").forEach((btn) => {
        btn.addEventListener("click", async () => {
            try {
                await alterarStatus(btn.dataset.id, "PREPARANDO");
                toast("Pedido marcado como PREPARANDO");
            } catch (erro) {
                console.error(erro);
                toast("Erro ao atualizar pedido.");
            }
        });
    });

    document.querySelectorAll(".btn-pronto").forEach((btn) => {
        btn.addEventListener("click", async () => {
            try {
                await alterarStatus(btn.dataset.id, "PRONTO");
                toast("Pedido marcado como PRONTO");
            } catch (erro) {
                console.error(erro);
                toast("Erro ao atualizar pedido.");
            }
        });
    });

    document.querySelectorAll(".btn-entregue").forEach((btn) => {
        btn.addEventListener("click", async () => {
            try {
                await alterarStatus(btn.dataset.id, "ENTREGUE");
                toast("Pedido marcado como ENTREGUE");
            } catch (erro) {
                console.error(erro);
                toast("Erro ao atualizar pedido.");
            }
        });
    });

    document.querySelectorAll(".btn-cancelar").forEach((btn) => {
        btn.addEventListener("click", async () => {
            try {
                await cancelarPedido(btn.dataset.id);
                toast("Pedido cancelado.");
            } catch (erro) {
                console.error(erro);
                toast("Erro ao cancelar pedido.");
            }
        });
    });
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
        `
    );

    document
        .getElementById("cancelarPedido")
        ?.addEventListener("click", fecharModal);

    document
        .getElementById("formNovoPedido")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();

            try {
                await criarPedido({
                    cliente: document.getElementById("cliente").value.trim(),
                    telefone: document.getElementById("telefone").value.trim(),
                    tipo: document.getElementById("tipoPedido").value,
                    observacoes: document.getElementById("observacoes").value.trim(),
                    itens: [],
                    valorTotal: 0,
                    pagamentoStatus: "PENDENTE"
                });

                toast("Pedido criado com sucesso!");
                fecharModal();

            } catch (erro) {
                console.error(erro);
                toast("Erro ao criar pedido.");
            }
        });
});