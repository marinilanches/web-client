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

ouvirClientes((clientes)=>{

clientesCache = clientes;


document.querySelector("#totalClientes")
.textContent =
clientes.length;



document.querySelector("#clientesVip")
.textContent =
clientes.filter(
c=>Number(c.totalPedidos||0)>5
).length;



let pedidos =
clientes.reduce(
(a,b)=>
a+Number(b.totalPedidos||0),
0
);


document.querySelector("#totalPedidosClientes")
.textContent =
pedidos;



let gasto =
clientes.reduce(
(a,b)=>
a+Number(b.totalGasto||0),
0
);


document.querySelector("#ticketMedio")
.textContent =
"R$ "+
(
gasto /
(clientes.length||1)
)
.toFixed(2);



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
            <tr>
                <td colspan="7">
                    Nenhum cliente encontrado
                </td>
            </tr>
        `;

        atualizarEstatisticas(clientes);

        return;
    }


    listaClientes.innerHTML = clientes.map(cliente => {

        return `

        <tr>

            <td>
                ${cliente.nome || "-"}
            </td>


            <td>
                ${cliente.telefone || "-"}
            </td>


            <td>
                -
            </td>


            <td>
                ${cliente.totalPedidos || 0}
            </td>


            <td>
                R$ ${Number(cliente.totalGasto || 0).toFixed(2)}
            </td>


            <td>
                🟢 Ativo
            </td>


            <td>
                <button class="btn btn-primary">
                    Editar
                </button>
            </td>

        </tr>

        `;

    }).join("");


    atualizarEstatisticas(clientes);

}

function atualizarEstatisticas(clientes) {

    const totalClientes =
        clientes.length;


    const clientesVip =
        clientes.filter(cliente =>
            Number(cliente.totalPedidos || 0) >= 5
        ).length;


    const totalPedidos =
        clientes.reduce(
            (total, cliente) =>
                total + Number(cliente.totalPedidos || 0),
            0
        );


    const totalGasto =
        clientes.reduce(
            (total, cliente) =>
                total + Number(cliente.totalGasto || 0),
            0
        );


    const ticketMedio =
        totalClientes
        ? totalGasto / totalClientes
        : 0;



    document.getElementById("totalClientes")
        .textContent = totalClientes;


    document.getElementById("clientesVip")
        .textContent = clientesVip;


    document.getElementById("totalPedidosClientes")
        .textContent = totalPedidos;


    document.getElementById("ticketMedio")
        .textContent =
        `R$ ${ticketMedio.toFixed(2)}`;

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