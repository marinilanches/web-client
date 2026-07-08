import {
  criarTaxaEntrega,
  editarTaxaEntrega,
  excluirTaxaEntrega,
  ouvirTaxasEntrega
} from "../../../js/services/delivery-fees.js";

const form = document.getElementById("taxaForm");
const formTitulo = document.getElementById("formTitulo");
const listaTaxas = document.getElementById("listaTaxas");

const nomeEl = document.getElementById("nome");
const taxaEl = document.getElementById("taxa");
const ordemEl = document.getElementById("ordem");
const ativoEl = document.getElementById("ativo");

const btnSalvar = document.getElementById("btnSalvar");
const btnCancelarEdicao = document.getElementById("btnCancelarEdicao");

let taxaEditandoId = null;
let taxasCache = [];

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function resetForm() {
  taxaEditandoId = null;
  form.reset();

  nomeEl.value = "";
  taxaEl.value = "";
  ordemEl.value = "";
  ativoEl.value = "true";

  formTitulo.textContent = "Cadastrar bairro";
  btnSalvar.textContent = "Salvar bairro";
  btnCancelarEdicao.style.display = "none";
}

function preencherFormulario(taxa) {
  taxaEditandoId = taxa.id;

  nomeEl.value = taxa.nome || "";
  taxaEl.value = Number(taxa.taxa || 0);
  ordemEl.value = Number(taxa.ordem || 0);
  ativoEl.value = String(Boolean(taxa.ativo));

  formTitulo.textContent = "Editar bairro";
  btnSalvar.textContent = "Salvar alterações";
  btnCancelarEdicao.style.display = "inline-block";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function validarFormulario() {
  const nome = nomeEl.value.trim();
  const taxa = Number(taxaEl.value || 0);

  if (!nome) {
    alert("Informe o nome do bairro.");
    nomeEl.focus();
    return false;
  }

  if (taxa < 0) {
    alert("A taxa não pode ser negativa.");
    taxaEl.focus();
    return false;
  }

  const nomeNormalizado = nome.toLowerCase();

  const duplicado = taxasCache.find((item) => {
    if (taxaEditandoId && item.id === taxaEditandoId) return false;
    return String(item.nome || "").trim().toLowerCase() === nomeNormalizado;
  });

  if (duplicado) {
    alert("Já existe um bairro com esse nome.");
    nomeEl.focus();
    return false;
  }

  return true;
}

function renderLista(taxas) {
  taxasCache = taxas;

  if (!Array.isArray(taxas) || taxas.length === 0) {
    listaTaxas.innerHTML = `
      <tr>
        <td colspan="5" class="taxas-empty">Nenhum bairro cadastrado.</td>
      </tr>
    `;
    return;
  }

  listaTaxas.innerHTML = taxas.map((taxa) => `
    <tr>
      <td>${taxa.nome || "—"}</td>
      <td>${formatarMoeda(taxa.taxa)}</td>
      <td>${Number(taxa.ordem || 0)}</td>
      <td>${taxa.ativo ? "Ativo" : "Inativo"}</td>
      <td>
        <div class="taxas-acoes-linha">
          <button
            class="btn"
            data-action="editar"
            data-id="${taxa.id}"
            type="button"
          >
            Editar
          </button>

          <button
            class="btn btn-danger"
            data-action="excluir"
            data-id="${taxa.id}"
            type="button"
          >
            Excluir
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

async function onSubmit(event) {
  event.preventDefault();

  if (!validarFormulario()) return;

  const payload = {
    nome: nomeEl.value.trim(),
    taxa: Number(taxaEl.value || 0),
    ordem: Number(ordemEl.value || 0),
    ativo: ativoEl.value === "true"
  };

  try {
    if (taxaEditandoId) {
      await editarTaxaEntrega(taxaEditandoId, payload);
      alert("Bairro atualizado com sucesso!");
    } else {
      await criarTaxaEntrega(payload);
      alert("Bairro cadastrado com sucesso!");
    }

    resetForm();
  } catch (erro) {
    console.error("Erro ao salvar taxa:", erro);
    alert("Não foi possível salvar o bairro.");
  }
}

async function onClickLista(event) {
  const botao = event.target.closest("button[data-action]");
  if (!botao) return;

  const action = botao.dataset.action;
  const id = botao.dataset.id;

  const taxa = taxasCache.find((item) => item.id === id);
  if (!taxa) return;

  if (action === "editar") {
    preencherFormulario(taxa);
    return;
  }

  if (action === "excluir") {
    const confirmar = confirm(`Excluir o bairro "${taxa.nome}"?`);
    if (!confirmar) return;

    try {
      await excluirTaxaEntrega(id);
      alert("Bairro excluído com sucesso!");

      if (taxaEditandoId === id) {
        resetForm();
      }
    } catch (erro) {
      console.error("Erro ao excluir bairro:", erro);
      alert("Não foi possível excluir o bairro.");
    }
  }
}

function init() {
  form.addEventListener("submit", onSubmit);
  btnCancelarEdicao.addEventListener("click", resetForm);
  listaTaxas.addEventListener("click", onClickLista);

  ouvirTaxasEntrega(renderLista);
}

init();