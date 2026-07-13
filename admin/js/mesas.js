import { abrirModal, fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

import {
    ouvirMesas,
    criarMesa,
    contarMesas
} from "../../js/services/tables.js";

/* ==========================================
   ELEMENTOS
========================================== */

const btnNovaMesa = document.getElementById("novaMesa");
const buscarMesa = document.getElementById("buscarMesa");
const filtroMesa = document.getElementById("filtroMesa");

const gridMesas = document.getElementById("gridMesas");

const totalMesas = document.getElementById("totalMesas");
const mesasLivres = document.getElementById("mesasLivres");
const mesasOcupadas = document.getElementById("mesasOcupadas");
const totalPessoas = document.getElementById("totalPessoas");

/* ==========================================
   ESTADO
========================================== */

let mesasCache = [];

/* ==========================================
   INIT
========================================== */

console.log("mesas.js carregado");

ouvirMesas((mesas) => {
    mesasCache = mesas;
    atualizarCards();
    aplicarFiltros();
});

buscarMesa?.addEventListener("input", aplicarFiltros);
filtroMesa?.addEventListener("change", aplicarFiltros);

/* ==========================================
   CARDS
========================================== */

function atualizarCards() {

    const contadores = contarMesas(mesasCache);

    if (totalMesas) totalMesas.textContent = contadores.total;
    if (mesasLivres) mesasLivres.textContent = contadores.livres;
    if (mesasOcupadas) mesasOcupadas.textContent = contadores.ocupadas;
    if (totalPessoas) totalPessoas.textContent = contadores.pessoas;

}

/* ==========================================
   FILTROS
========================================== */

function aplicarFiltros() {

    let mesas = [...mesasCache];

    const termo = buscarMesa?.value?.trim().toLowerCase() || "";
    const status = filtroMesa?.value?.trim() || "";

    if (status) {
        mesas = mesas.filter((mesa) => mesa.status === status);
    }

    if (termo) {
        mesas = mesas.filter((mesa) => {
            const numero = String(mesa.numero || "").toLowerCase();
            const statusMesa = (mesa.status || "").toLowerCase();

            return (
                numero.includes(termo) ||
                statusMesa.includes(termo)
            );
        });
    }

    renderMesas(mesas);

}

/* ==========================================
   RENDER
========================================== */

function renderMesas(mesas) {

    if (!gridMesas) return;

    if (!mesas.length) {
        gridMesas.innerHTML = `
            <div class="empty-state">
                <h3>Nenhuma mesa encontrada</h3>
                <p>As mesas cadastradas aparecerão aqui.</p>
            </div>
        `;
        return;
    }

    gridMesas.innerHTML = "";

    mesas.forEach((mesa) => {

        const card = document.createElement("div");
        card.className = "panel";

        card.innerHTML = `
            <div class="panel-title">
                Mesa ${mesa.numero || "-"}
            </div>

            <p>
                <strong>Status:</strong>
                ${mesa.status || "-"}
            </p>

            <p>
                <strong>Capacidade:</strong>
                ${mesa.capacidade || 0} pessoas
            </p>

            <p>
                <strong>Pessoas na mesa:</strong>
                ${mesa.pessoas || 0}
            </p>

            <p>
                <strong>Observações:</strong>
                ${mesa.observacoes || "-"}
            </p>
        `;

        gridMesas.appendChild(card);

    });

}

/* ==========================================
   NOVA MESA
========================================== */

btnNovaMesa?.addEventListener("click", () => {

    abrirModal(
        "Nova Mesa",
        `
        <form id="formNovaMesa" class="form-grid">

            <div class="form-group">
                <label>Número da Mesa</label>
                <input type="number" id="numeroMesa" required>
            </div>

            <div class="form-group">
                <label>Capacidade</label>
                <input type="number" id="capacidadeMesa" value="4" required>
            </div>

            <div class="form-group">
                <label>Status</label>
                <select id="statusMesa">
                    <option value="LIVRE">Livre</option>
                    <option value="OCUPADA">Ocupada</option>
                    <option value="RESERVADA">Reservada</option>
                    <option value="MANUTENCAO">Manutenção</option>
                </select>
            </div>

            <div class="form-group">
                <label>Observações</label>
                <textarea id="observacoesMesa"></textarea>
            </div>

            <div class="modal-actions">
                <button
                    type="button"
                    id="cancelarMesa"
                    class="btn btn-secondary">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="btn btn-primary">
                    Salvar Mesa
                </button>
            </div>

        </form>
        `
    );

    document
        .getElementById("cancelarMesa")
        ?.addEventListener("click", fecharModal);

    document
        .getElementById("formNovaMesa")
        ?.addEventListener("submit", async (e) => {

            e.preventDefault();

            try {

                await criarMesa({
                    numero: document.getElementById("numeroMesa").value,
                    capacidade: document.getElementById("capacidadeMesa").value,
                    status: document.getElementById("statusMesa").value,
                    pessoas: 0,
                    observacoes: document.getElementById("observacoesMesa").value.trim()
                });

                toast("Mesa criada com sucesso!");
                fecharModal();

            } catch (erro) {

                console.error(erro);
                toast("Erro ao criar mesa.");

            }

        });

});