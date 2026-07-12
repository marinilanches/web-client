import {
    ouvirClientes,
    criarCliente
} from "../../js/services/clients.js";

import {
    abrirModal,
    fecharModal
} from "../components/modal.js";

import {
    toast
} from "../components/toast.js";

/* ==========================================================
   ELEMENTOS
========================================================== */

const selectCliente =
    document.getElementById("clientePDV");

/* ==========================================================
   ESTADO
========================================================== */

let clientesCache = [];

let clienteSelecionado = null;

/* ==========================================================
   INIT
========================================================== */

export function initCliente() {

    bindEventos();

    carregarClientes();

}

/* ==========================================================
   CARREGAR CLIENTES
========================================================== */

function carregarClientes() {

    ouvirClientes((clientes) => {

        clientesCache = ordenarClientes(clientes);

        renderClientes();

    });

}

/* ==========================================================
   RENDER
========================================================== */

function renderClientes() {

    if (!selectCliente) return;

    const valorAtual =
        selectCliente.value;

    selectCliente.innerHTML = "";

    adicionarOpcaoConsumidorFinal();

    clientesCache.forEach((cliente) => {

        selectCliente.appendChild(
            criarOptionCliente(cliente)
        );

    });

    adicionarOpcaoNovoCliente();

    if (
        valorAtual &&
        [...selectCliente.options]
            .some(option => option.value === valorAtual)
    ) {

        selectCliente.value = valorAtual;

    }

}

/* ==========================================================
   OPTIONS
========================================================== */

function adicionarOpcaoConsumidorFinal() {

    const option =
        document.createElement("option");

    option.value = "";

    option.textContent =
        "Consumidor Final";

    selectCliente.appendChild(option);

}

function adicionarOpcaoNovoCliente() {

    const option =
        document.createElement("option");

    option.value = "__NOVO__";

    option.textContent =
        "➕ Novo Cliente";

    selectCliente.appendChild(option);

}

function criarOptionCliente(cliente) {

    const option =
        document.createElement("option");

    option.value = cliente.id;

    option.textContent =
        cliente.telefone
            ? `${cliente.nome} • ${cliente.telefone}`
            : cliente.nome;

    return option;

}

/* ==========================================================
   EVENTOS
========================================================== */

function bindEventos() {

    selectCliente?.addEventListener(

        "change",

        onChangeCliente

    );

}

function onChangeCliente() {

    const id =
        selectCliente.value;

    if (id === "") {

        selecionarConsumidorFinal();

        return;

    }

    if (id === "__NOVO__") {

        abrirModalNovoCliente();

        return;

    }

    selecionarCliente(id);

}

/* ==========================================================
   SELEÇÃO
========================================================== */

function selecionarCliente(id) {

    const cliente = buscarClientePorId(id);

    if (!cliente) {

        selecionarConsumidorFinal();

        return;

    }

    clienteSelecionado = cliente;

}

function selecionarConsumidorFinal() {

    clienteSelecionado = null;

    if (selectCliente) {
        selectCliente.value = "";
    }

}

export function limparCliente() {

    selecionarConsumidorFinal();

}

export function selecionarClientePorId(id) {

    if (!id) {

        selecionarConsumidorFinal();
        return;

    }

    if (selectCliente) {
        selectCliente.value = id;
    }

    selecionarCliente(id);

}

/* ==========================================================
   GETTERS
========================================================== */

export function getClienteSelecionado() {

    return clienteSelecionado;

}

export function getClienteId() {

    return clienteSelecionado?.id || null;

}

export function getNomeCliente() {

    return clienteSelecionado?.nome || "";

}

export function getTelefoneCliente() {

    return clienteSelecionado?.telefone || "";

}

export function possuiClienteSelecionado() {

    return clienteSelecionado !== null;

}

/* ==========================================================
   HELPERS
========================================================== */

function buscarClientePorId(id) {

    return clientesCache.find(

        cliente => cliente.id === id

    ) || null;

}

function ordenarClientes(clientes = []) {

    return [...clientes].sort((a, b) => {

        const nomeA =
            String(a.nome || "");

        const nomeB =
            String(b.nome || "");

        return nomeA.localeCompare(

            nomeB,
            "pt-BR"

        );

    });

}

export function getClientes() {

    return [...clientesCache];

}

export function atualizarClientes() {

    carregarClientes();

}

/* ==========================================================
   NOVO CLIENTE
========================================================== */

function abrirModalNovoCliente() {

    abrirModal(
        "Novo Cliente",
        `
        <form id="formNovoClientePDV" class="form-grid">

            <div class="form-group">

                <label>Nome</label>

                <input
                    id="pdvNomeCliente"
                    type="text"
                    required
                >

            </div>

            <div class="form-group">

                <label>Telefone</label>

                <input
                    id="pdvTelefoneCliente"
                    type="text"
                >

            </div>

            <div class="form-group">

                <label>Observações</label>

                <textarea
                    id="pdvObservacoesCliente"
                ></textarea>

            </div>

            <div class="modal-actions">

                <button
                    type="button"
                    id="cancelarNovoClientePDV"
                    class="btn btn-secondary">

                    Cancelar

                </button>

                <button
                    type="submit"
                    class="btn btn-primary">

                    Salvar Cliente

                </button>

            </div>

        </form>
        `
    );

    document
        .getElementById("cancelarNovoClientePDV")
        ?.addEventListener(
            "click",
            cancelarCadastroCliente
        );

    document
        .getElementById("formNovoClientePDV")
        ?.addEventListener(
            "submit",
            salvarNovoCliente
        );

}

/* ==========================================================
   SALVAR
========================================================== */

async function salvarNovoCliente(evento) {

    evento.preventDefault();

    try {

        const dados = obterDadosFormulario();

        if (!dados.nome) {

            toast("Informe o nome do cliente.");

            return;

        }

        const referencia = await criarCliente({

            nome: dados.nome,

            telefone: dados.telefone,

            observacoes: dados.observacoes,

            totalPedidos: 0,

            totalGasto: 0

        });

        toast("Cliente cadastrado com sucesso!");

        fecharModal();

        selecionarClienteRecemCriado(referencia.id);

    } catch (erro) {

        console.error(erro);

        toast("Erro ao cadastrar cliente.");

    }

}

/* ==========================================================
   FORMULÁRIO
========================================================== */

function obterDadosFormulario() {

    return {

        nome:
            document
                .getElementById("pdvNomeCliente")
                ?.value
                .trim() || "",

        telefone:
            document
                .getElementById("pdvTelefoneCliente")
                ?.value
                .trim() || "",

        observacoes:
            document
                .getElementById("pdvObservacoesCliente")
                ?.value
                .trim() || ""

    };

}

function cancelarCadastroCliente() {

    fecharModal();

    if (selectCliente) {

        selectCliente.value =
            clienteSelecionado?.id || "";

    }

}

/* ==========================================================
   SELECIONAR CLIENTE CRIADO
========================================================== */

function selecionarClienteRecemCriado(id) {

    if (!id) return;

    const unsubscribe = ouvirClientes((clientes) => {

        clientesCache = ordenarClientes(clientes);

        renderClientes();

        if (clientes.some(cliente => cliente.id === id)) {

            unsubscribe();

            selecionarClientePorId(id);

        }

    });

}