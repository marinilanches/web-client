import { ouvirClientes, criarCliente } from "../../../js/services/clients.js";

import { abrirModal, fecharModal } from "../../components/modal.js";

import { toast } from "../../components/toast.js";

/* ==========================================================
   ELEMENTOS
========================================================== */

const selectCliente = document.getElementById("clientePDV");

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

export function carregarClientes() {
  try {
    ouvirClientes(
      (clientes) => {
        clientesCache = ordenarClientes(clientes);

        atualizarSelectClientes();
      },

      (erro) => {
        console.error(erro);

        toast("Erro ao sincronizar clientes.");
      },
    );
  } catch (erro) {
    console.error(erro);

    toast("Erro ao carregar clientes.");
  }
}

/* ==========================================================
   ATUALIZAR SELECT
========================================================== */

function atualizarSelectClientes() {
  const clienteAtual = clienteSelecionado?.id || "";

  renderClientes();

  if (
    clienteAtual &&
    [...selectCliente.options].some((option) => option.value === clienteAtual)
  ) {
    selectCliente.value = clienteAtual;
  }
}

/* ==========================================================
   RENDER
========================================================== */

function renderClientes() {
  if (!selectCliente) return;

  const valorAtual = selectCliente.value;

  selectCliente.innerHTML = "";

  adicionarOpcaoConsumidorFinal();

  clientesCache.forEach((cliente) => {
    selectCliente.appendChild(criarOptionCliente(cliente));
  });

  adicionarOpcaoNovoCliente();

  if (
    valorAtual &&
    [...selectCliente.options].some((option) => option.value === valorAtual)
  ) {
    selectCliente.value = valorAtual;
  }
}

/* ==========================================================
   OPTIONS
========================================================== */

function adicionarOpcaoConsumidorFinal() {
  const option = document.createElement("option");

  option.value = "";

  option.textContent = "Consumidor Final";

  selectCliente.appendChild(option);
}

function adicionarOpcaoNovoCliente() {
  const option = document.createElement("option");

  option.value = "__NOVO__";

  option.textContent = "➕ Novo Cliente";

  selectCliente.appendChild(option);
}

function criarOptionCliente(cliente) {
  const option = document.createElement("option");

  option.value = cliente.id;

  option.textContent = cliente.telefone
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

    onChangeCliente,
  );
}

function onChangeCliente() {
  const id = selectCliente.value;

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

  const cliente = buscarClientePorId(id);

  if (!cliente) {
    toast("Cliente não encontrado.");

    selecionarConsumidorFinal();

    return;
  }

  clienteSelecionado = cliente;

  if (selectCliente) {
    selectCliente.value = id;
  }
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
  return clientesCache.find((cliente) => cliente.id === id) || null;
}

function ordenarClientes(clientes = []) {
  return [...clientes].sort((a, b) => {
    const nomeA = String(a.nome || "");

    const nomeB = String(b.nome || "");

    return nomeA.localeCompare(nomeB, "pt-BR");
  });
}

export function getClientes() {
  return [...clientesCache];
}

export function getEnderecoCliente() {
  return clienteSelecionado?.endereco || null;
}

/* ==========================================================
   RESET DO MÓDULO
========================================================== */

export function resetClientePDV() {
  clienteSelecionado = null;

  clientesCache = [];

  if (selectCliente) {
    selectCliente.innerHTML = "";

    adicionarOpcaoConsumidorFinal();

    adicionarOpcaoNovoCliente();

    selectCliente.value = "";
  }
}

/* ==========================================================
   ATUALIZAÇÃO EXTERNA
========================================================== */

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
                    type="tel"
                    maxlength="19"
                    placeholder="+55 (19) 99999-9999"
                >

            </div>

            <div class="form-group">

                <label>Observações</label>

                <textarea
                    id="pdvObservacoesCliente"
                ></textarea>

            </div>

            <div class="form-group">

                <label>Rua</label>

                <input
                    id="pdvRuaCliente"
                    type="text"
                >

            </div>


            <div class="form-group">

                <label>Número</label>

                <input
                    id="pdvNumeroCliente"
                    type="text"
                >

            </div>


            <div class="form-group">

                <label>CEP</label>

                <input
                  id="pdvCepCliente"
                  type="tel"
                />

            </div>


            <div class="form-group">

                <label>Complemento</label>

                <input
                    id="pdvComplementoCliente"
                    type="text"
                >

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
        `,
  );

  aplicarMascaraTelefone(document.getElementById("pdvTelefoneCliente"));

  document
    .getElementById("cancelarNovoClientePDV")
    ?.addEventListener("click", cancelarCadastroCliente);

  document
    .getElementById("formNovoClientePDV")
    ?.addEventListener("submit", salvarNovoCliente);
}

function aplicarMascaraTelefone(input) {
  if (!input) return;

  // Preenche automaticamente o código do país
  input.value = "+55 ";

  input.addEventListener("focus", () => {
    if (!input.value.trim()) {
      input.value = "+55 ";
    }
  });

  input.addEventListener("input", () => {
    // Mantém sempre o +55
    let numeros = input.value.replace(/\D/g, "");

    if (!numeros.startsWith("55")) {
      numeros = "55" + numeros.replace(/^55/, "");
    }

    numeros = numeros.substring(0, 13);

    let valor = "+55";

    if (numeros.length > 2) {
      valor += " (" + numeros.substring(2, 4);
    }

    if (numeros.length >= 4) {
      valor += ")";
    }

    if (numeros.length > 4) {
      valor += " " + numeros.substring(4, 9);
    }

    if (numeros.length > 9) {
      valor += "-" + numeros.substring(9, 13);
    }

    input.value = valor;
  });
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
      telefoneWhatsapp: dados.telefone.replace(/\D/g, ""),

      observacoes: dados.observacoes,

      endereco: dados.endereco,

      totalPedidos: 0,

      totalGasto: 0,
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
    nome: document.getElementById("pdvNomeCliente")?.value.trim() || "",

    telefone: document.getElementById("pdvTelefoneCliente")?.value.trim() || "",

    observacoes:
      document.getElementById("pdvObservacoesCliente")?.value.trim() || "",

    endereco: {
      rua: document.getElementById("pdvRuaCliente")?.value.trim() || "",

      numero: document.getElementById("pdvNumeroCliente")?.value.trim() || "",

      cep: document.getElementById("pdvCepCliente")?.value.trim() || "",

      latitude: null,

      longitude: null,

      complemento:
        document.getElementById("pdvComplementoCliente")?.value.trim() || "",
    },
  };
}

function cancelarCadastroCliente() {
  fecharModal();

  if (selectCliente) {
    selectCliente.value = clienteSelecionado?.id || "";
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

    if (clientes.some((cliente) => cliente.id === id)) {
      unsubscribe();

      selecionarClientePorId(id);
    }
  });
}
