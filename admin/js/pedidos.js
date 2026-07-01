import { abrirModal, fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

import {
    ouvirPedidos,
    criarPedido
} from "../../js/orders.js";

/* ==========================================
   INICIALIZAÇÃO
========================================== */

console.log("pedidos.js carregado");

const listaPedidos = document.getElementById("listaPedidos");
const btnNovoPedido = document.getElementById("novoPedido");

/* ==========================================
   LISTA EM TEMPO REAL
========================================== */

ouvirPedidos((pedidos) => {

    renderPedidos(pedidos);

});

/* ==========================================
   RENDERIZA PEDIDOS
========================================== */

function renderPedidos(pedidos) {

    if (!listaPedidos) return;

    if (pedidos.length === 0) {

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

        listaPedidos.innerHTML += `

            <div class="panel">

                <div class="panel-title">

                    ${pedido.cliente || "Cliente"}

                </div>

                <p>

                    <strong>Status:</strong>

                    ${pedido.status}

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

            </div>

        `;

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

                <input
                    type="text"
                    id="cliente"
                    required>

            </div>

            <div class="form-group">

                <label>Telefone</label>

                <input
                    type="text"
                    id="telefone">

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
        .addEventListener("click", fecharModal);

    document
        .getElementById("formNovoPedido")
        .addEventListener("submit", async (e) => {

            e.preventDefault();

            try {

                await criarPedido({

                    cliente: document.getElementById("cliente").value,

                    telefone: document.getElementById("telefone").value,

                    tipo: document.getElementById("tipoPedido").value,

                    observacoes: document.getElementById("observacoes").value,

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