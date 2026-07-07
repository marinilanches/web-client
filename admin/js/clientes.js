import { abrirModal, fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

import {
    ouvirClientes,
    criarCliente
} from "../../js/services/clients.js";

/* ==========================================
   ELEMENTOS
========================================== */

const listaClientes = document.getElementById("listaClientes");
const btnNovoCliente = document.getElementById("novoCliente");
const buscarCliente = document.getElementById("buscarCliente");

/* ==========================================
   ESTADO
========================================== */

let clientesCache = [];

/* ==========================================
   INIT
========================================== */

console.log("clientes.js carregado");

ouvirClientes((clientes) => {
    clientesCache = clientes;
    aplicarFiltros();
});

buscarCliente?.addEventListener("input", aplicarFiltros);

/* ==========================================
   FILTROS
========================================== */

function aplicarFiltros() {

    let clientes = [...clientesCache];
    const termo = buscarCliente?.value?.trim().toLowerCase() || "";

    if (termo) {
        clientes = clientes.filter((cliente) => {
            const nome = (cliente.nome || "").toLowerCase();
            const telefone = (cliente.telefone || "").toLowerCase();

            return (
                nome.includes(termo) ||
                telefone.includes(termo)
            );
        });
    }

    renderClientes(clientes);

}

/* ==========================================
   RENDER
========================================== */

function renderClientes(clientes) {

    if (!listaClientes) return;

    if (!clientes.length) {
        listaClientes.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum cliente encontrado</h3>
                <p>Os clientes cadastrados aparecerão aqui.</p>
            </div>
        `;
        return;
    }

    listaClientes.innerHTML = "";

    clientes.forEach((cliente) => {

        const card = document.createElement("div");
        card.className = "panel";

        card.innerHTML = `
            <div class="panel-title">
                ${cliente.nome || "Cliente sem nome"}
            </div>

            <p>
                <strong>Telefone:</strong>
                ${cliente.telefone || "-"}
            </p>

            <p>
                <strong>Total de pedidos:</strong>
                ${cliente.totalPedidos ?? 0}
            </p>

            <p>
                <strong>Total gasto:</strong>
                R$ ${Number(cliente.totalGasto || 0).toFixed(2)}
            </p>

            <p>
                <strong>Observações:</strong>
                ${cliente.observacoes || "-"}
            </p>
        `;

        listaClientes.appendChild(card);

    });

}

/* ==========================================
   NOVO CLIENTE
========================================== */

btnNovoCliente?.addEventListener("click", () => {

    abrirModal(
        "Novo Cliente",
        `
        <form id="formNovoCliente" class="form-grid">

            <div class="form-group">
                <label>Nome</label>
                <input type="text" id="nomeCliente" required>
            </div>

            <div class="form-group">
                <label>Telefone</label>
                <input type="text" id="telefoneCliente">
            </div>

            <div class="form-group">
                <label>Observações</label>
                <textarea id="observacoesCliente"></textarea>
            </div>

            <div class="modal-actions">
                <button
                    type="button"
                    id="cancelarCliente"
                    class="btn btn-secondary">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="btn btn-primary">
                    Salvar
                </button>
            </div>

        </form>
        `
    );

    document
        .getElementById("cancelarCliente")
        ?.addEventListener("click", fecharModal);

    document
        .getElementById("formNovoCliente")
        ?.addEventListener("submit", async (e) => {

            e.preventDefault();

            try {

                await criarCliente({
                    nome: document.getElementById("nomeCliente").value.trim(),
                    telefone: document.getElementById("telefoneCliente").value.trim(),
                    observacoes: document.getElementById("observacoesCliente").value.trim(),
                    totalPedidos: 0,
                    totalGasto: 0
                });

                toast("Cliente criado com sucesso!");
                fecharModal();

            } catch (erro) {

                console.error(erro);
                toast("Erro ao criar cliente.");

            }

        });

});