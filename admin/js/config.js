import { db } from "../../js/services/firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const COLLECTION_NAME = "configuracoes";
const DOC_ID = "geral";

function getElements() {
  return {
    form: document.getElementById("formConfiguracoes"),
    btnSalvar: document.getElementById("btnSalvar"),
    btnRestaurar: document.getElementById("btnRestaurar"),

    nomeLoja: document.getElementById("nomeLoja"),
    telefone: document.getElementById("telefone"),
    whatsapp: document.getElementById("whatsapp"),
    email: document.getElementById("email"),
    endereco: document.getElementById("endereco"),

    abertura: document.getElementById("abertura"),
    fechamento: document.getElementById("fechamento"),
    statusLoja: document.getElementById("statusLoja"),

    delivery: document.getElementById("delivery"),
    retirada: document.getElementById("retirada"),
    distancia: document.getElementById("distancia"),
    bairro: document.getElementById("bairro"),

    listaPagamentos: document.getElementById("listaPagamentos"),
    btnAdicionarPagamento: document.getElementById("btnAdicionarPagamento"),

    registrarLogs: document.getElementById("registrarLogs"),
    backupAutomatico: document.getElementById("backupAutomatico"),
  };
}

function validarElementos(el) {
  const faltando = Object.entries(el)
    .filter(([_, valor]) => !valor)
    .map(([chave]) => chave);

  if (faltando.length > 0) {
    console.error("Elementos não encontrados na página:", faltando);
    throw new Error(
      `Os seguintes elementos não foram encontrados no HTML: ${faltando.join(", ")}`,
    );
  }
}

function coletarDados(el) {
  return {
    loja: {
      nome: el.nomeLoja.value.trim(),
      telefone: el.telefone.value.trim(),
      whatsapp: el.whatsapp.value.trim(),
      email: el.email.value.trim(),
      endereco: el.endereco.value.trim(),
    },

    funcionamento: {
      abertura: el.abertura.value || "",
      fechamento: el.fechamento.value || "",
      statusManual: el.statusLoja.value || "AUTO",
    },

    delivery: {
      ativo: el.delivery.checked,
      retirada: el.retirada.checked,
      taxaPorDistancia: el.distancia.checked,
      taxaPorBairro: el.bairro.checked,
    },

    pagamentos: obterPagamentos(),

    seguranca: {
      registrarLogs: el.registrarLogs.checked,
      backupAutomatico: el.backupAutomatico.checked,
    },

    localizacao: {
      latitude: -23.000761054962886,
      longitude: -47.51735362883598,
    },

    updatedAt: serverTimestamp(),
  };
}

function preencherFormulario(el, dados = {}) {
  const localizacao = dados.localizacao || {};
  const loja = dados.loja || {};
  const funcionamento = dados.funcionamento || {};
  const delivery = dados.delivery || {};
  let pagamentos = dados.pagamentos || [];

  if (!Array.isArray(pagamentos)) {
    pagamentos = [
      {
        id: "pix",
        nome: "PIX",
        ativo: pagamentos.pix ?? true,
      },
      {
        id: "dinheiro",
        nome: "Dinheiro",
        ativo: pagamentos.dinheiro ?? true,
      },
      {
        id: "cartao",
        nome: "Cartão",
        ativo: pagamentos.cartao ?? true,
      },
      {
        id: "pagbank",
        nome: "PagBank",
        ativo: pagamentos.pagbank ?? true,
      },
    ];
  }
  const seguranca = dados.seguranca || {};

  el.nomeLoja.value = loja.nome || "";
  el.telefone.value = loja.telefone || "";
  el.whatsapp.value = loja.whatsapp || "";
  el.email.value = loja.email || "";
  el.endereco.value = loja.endereco || "";

  el.abertura.value = funcionamento.abertura || "";
  el.fechamento.value = funcionamento.fechamento || "";
  el.statusLoja.value = funcionamento.statusManual || "AUTO";

  el.delivery.checked = delivery.ativo ?? true;
  el.retirada.checked = delivery.retirada ?? true;
  if (delivery.taxaPorDistancia) {
    el.distancia.checked = true;
    el.bairro.checked = false;
  } else {
    el.distancia.checked = false;
    el.bairro.checked = true;
  }

  renderizarPagamentos(pagamentos);

  el.registrarLogs.checked = seguranca.registrarLogs ?? true;
  el.backupAutomatico.checked = seguranca.backupAutomatico ?? true;
  console.log("Localização cadastrada:", {
    latitude: localizacao.latitude || null,
    longitude: localizacao.longitude || null,
  });
}

async function carregarConfiguracoes(el) {
  try {
    const ref = doc(db, COLLECTION_NAME, DOC_ID);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      preencherFormulario(el, snap.data());
    } else {
      preencherFormulario(el, {});
    }
  } catch (error) {
    console.error("Erro ao carregar configurações:", error);
    alert("Erro ao carregar configurações. Verifique o console.");
  }
}

async function salvarConfiguracoes(el) {
  const dados = coletarDados(el);
  const ref = doc(db, COLLECTION_NAME, DOC_ID);

  await setDoc(ref, dados, { merge: true });
}

function restaurarPadrao(el) {
  preencherFormulario(el, {
    loja: {
      nome: "",
      telefone: "",
      whatsapp: "",
      email: "",
      endereco: "",
    },
    funcionamento: {
      abertura: "",
      fechamento: "",
      statusManual: "AUTO",
    },
    delivery: {
      ativo: true,
      retirada: true,
      taxaPorDistancia: false,
      taxaPorBairro: true,
    },
    pagamentos: [
      {
        id: "pix",
        nome: "PIX",
        ativo: true,
      },
      {
        id: "dinheiro",
        nome: "Dinheiro",
        ativo: true,
      },
      {
        id: "cartao",
        nome: "Cartão",
        ativo: true,
      },
      {
        id: "pagbank",
        nome: "PagBank",
        ativo: true,
      },
    ],
    seguranca: {
      registrarLogs: true,
      backupAutomatico: true,
    },
  });
}

function registrarEventos(el) {
  el.distancia.addEventListener("change", () => {
    if (el.distancia.checked) {
      el.bairro.checked = false;
    }
  });

  el.bairro.addEventListener("change", () => {
    if (el.bairro.checked) {
      el.distancia.checked = false;
    }
  });

  el.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      el.btnSalvar.disabled = true;
      el.btnSalvar.textContent = "Salvando...";

      await salvarConfiguracoes(el);

      alert("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      alert("Erro ao salvar configurações. Verifique o console.");
    } finally {
      el.btnSalvar.disabled = false;
      el.btnSalvar.textContent = "💾 Salvar Configurações";
    }
  });

  el.btnRestaurar.addEventListener("click", () => {
    const confirmar = confirm(
      "Deseja restaurar os valores padrão do formulário?",
    );
    if (!confirmar) return;

    restaurarPadrao(el);
  });
  let pagamentos = [];

  el.btnAdicionarPagamento.addEventListener("click", () => {

    const nome = prompt("Nome da nova forma de pagamento:");

    if (!nome) return;

    pagamentos = obterPagamentos();

    pagamentos.push({

      id: nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_"),

      nome,

      ativo: true

    });

    renderizarPagamentos(pagamentos);

  });
}

function renderizarPagamentos(pagamentos = []) {

  const lista = document.getElementById("listaPagamentos");

  if (!lista) return;

  lista.innerHTML = "";

  pagamentos.forEach((pagamento, index) => {

    const linha = document.createElement("div");

    linha.className = "pagamento-item";

    linha.innerHTML = `
      <label>
        <input
          type="checkbox"
          ${pagamento.ativo ? "checked" : ""}
        >
        ${pagamento.nome}
      </label>

      <button
        type="button"
        class="btn-remover-pagamento">
        🗑
      </button>
    `;

    linha
      .querySelector(".btn-remover-pagamento")
      .addEventListener("click", () => {
        pagamentos.splice(index, 1);
        renderizarPagamentos(pagamentos);
      });

    lista.appendChild(linha);

  });

}

function obterPagamentos() {

  const lista = document.getElementById("listaPagamentos");

  return [...lista.querySelectorAll(".pagamento-item")].map((item) => {

    const checkbox = item.querySelector("input");

    return {

      id: item.textContent
        .replace("🗑", "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_"),

      nome: item.textContent
        .replace("🗑", "")
        .trim(),

      ativo: checkbox.checked

    };

  });

}

async function init() {
  const el = getElements();
  validarElementos(el);
  registrarEventos(el);
  await carregarConfiguracoes(el);
}

document.addEventListener("DOMContentLoaded", init);