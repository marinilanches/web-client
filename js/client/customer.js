import { buscarCliente, salvarCliente } from "../services/customers.js";

import { buscarBairrosPorNome } from "../services/delivery-fees.js";

import {
  buscarEnderecos,
  buscarDetalhesEndereco,
} from "../services/address-search.js";

let timeoutAutocomplete = null;

let latitudeCliente = null;

let longitudeCliente = null;

/* ==========================================================
   AUTOCOMPLETE DE ENDEREÇO
========================================================== */

function fecharSugestoesRua() {
  const lista = document.getElementById("clienteRuaSugestoes");

  if (lista) {
    lista.innerHTML = "";
    lista.style.display = "none";
  }
}

function renderizarSugestoesRua(resultados) {
  const lista = document.getElementById("clienteRuaSugestoes");

  const rua = document.getElementById("clienteRua");

  const bairro = document.getElementById("clienteBairro");

  const numero = document.getElementById("clienteNumero");

  if (!lista) return;

  lista.innerHTML = "";

  if (!resultados.length) {
    lista.style.display = "none";
    return;
  }

  resultados.forEach((item) => {
    const div = document.createElement("div");

    div.className = "autocomplete-item";

    div.innerHTML = `
      <div class="autocomplete-title">
        📍 ${item.rua || "Endereço"}
      </div>

      <div class="autocomplete-subtitle">
        ${item.cidade || ""} - ${item.estado || ""}
      </div>
    `;

    div.addEventListener("click", async () => {
      rua.value = item.rua || "";

      numero.value = "";

      latitudeCliente = item.latitude;

      longitudeCliente = item.longitude;

      try {
        const detalhes = await buscarDetalhesEndereco(
          item.latitude,
          item.longitude,
        );

        bairro.value = detalhes.bairro || item.bairro || "";
      } catch (erro) {
        console.error("Erro ao buscar detalhes do endereço:", erro);

        bairro.value = item.bairro || "";
      }

      fecharSugestoesRua();

      numero.focus();
    });

    lista.appendChild(div);
  });

  lista.style.display = "block";
}

async function pesquisarRua() {
  const rua = document.getElementById("clienteRua");

  if (!rua) return;

  const texto = rua.value.trim();

  if (texto.length < 2) {
    fecharSugestoesRua();

    return;
  }

  try {
    const resultados = await buscarEnderecos(texto);

    renderizarSugestoesRua(resultados);
  } catch (erro) {
    console.error("Erro ao buscar ruas:", erro);
  }
}

/* ==========================================================
   INICIAR CLIENTE
========================================================== */

export async function iniciarCliente() {
  const cliente = await buscarCliente();

  if (cliente) {
    preencherCampos(cliente);
  }

  const btn = document.getElementById("salvarClienteBtn");

  if (btn) {
    btn.addEventListener("click", salvarDadosCliente);
  }

  const telefone = document.getElementById("clienteTelefone");

  if (telefone) {
    telefone.addEventListener("input", () => {
      telefone.value = formatarTelefone(telefone.value);
    });
  }

  const rua = document.getElementById("clienteRua");

  if (rua) {
    rua.addEventListener("input", () => {
      clearTimeout(timeoutAutocomplete);

      timeoutAutocomplete = setTimeout(pesquisarRua, 300);
    });
  }

  document.addEventListener("click", (event) => {
    if (
      !event.target.closest("#clienteRua") &&
      !event.target.closest("#clienteRuaSugestoes")
    ) {
      fecharSugestoesRua();
    }
  });
}

/* ==========================================================
   SALVAR CLIENTE
========================================================== */

async function salvarDadosCliente() {
  const nome = document.getElementById("clienteNome")?.value;

  const telefone = document.getElementById("clienteTelefone")?.value;

  const observacoes =
    document.getElementById("clienteObservacoes")?.value || "";

  const endereco = {
    cep: document.getElementById("clienteCep")?.value || "",

    rua: document.getElementById("clienteRua")?.value || "",

    numero: document.getElementById("clienteNumero")?.value || "",

    bairro: document.getElementById("clienteBairro")?.value || "",

    complemento: document.getElementById("clienteComplemento")?.value || "",

    latitude: latitudeCliente,

    longitude: longitudeCliente,
  };

  if (!nome || !telefone) {
    alert("Informe nome e telefone");

    return;
  }

  const bairroDigitado = endereco.bairro.trim();

  let bairroFinal = bairroDigitado;

  if (bairroDigitado) {
    const bairros = await buscarBairrosPorNome(bairroDigitado);

    if (bairros.length > 1) {
      const escolha = prompt(
        `Encontramos mais de um bairro:

${bairros.map((b, i) => `${i + 1} - ${b.nome}`).join("\n")}


Digite o número correto:`,
      );

      const indice = Number(escolha) - 1;

      if (bairros[indice]) {
        bairroFinal = bairros[indice].nome;
      }
    }

    if (bairros.length === 1) {
      bairroFinal = bairros[0].nome;
    }
  }

  endereco.bairro = bairroFinal;

  const btn = document.getElementById("salvarClienteBtn");

  btn.disabled = true;

  btn.textContent = "Salvando...";

  try {
    await salvarCliente({
      nome,

      telefone,

      observacoes,

      endereco,
    });

    alert("Dados salvos!");
  } finally {
    btn.disabled = false;

    btn.textContent = "Salvar";
  }

  fecharModalCliente();
}

/* ==========================================================
   PREENCHER CAMPOS
========================================================== */

function preencherCampos(cliente) {
  const nome = document.getElementById("clienteNome");

  const telefone = document.getElementById("clienteTelefone");

  const observacoes = document.getElementById("clienteObservacoes");

  const rua = document.getElementById("clienteRua");

  const cep = document.getElementById("clienteCep");

  const numero = document.getElementById("clienteNumero");

  const bairro = document.getElementById("clienteBairro");

  const complemento = document.getElementById("clienteComplemento");

  if (nome) nome.value = cliente.nome || "";

  if (telefone) telefone.value = cliente.telefone || "";

  if (observacoes) observacoes.value = cliente.observacoes || "";

  if (rua) rua.value = cliente.endereco?.rua || "";

  if (cep) cep.value = cliente.endereco?.cep || "";

  if (numero) numero.value = cliente.endereco?.numero || "";

  if (bairro) bairro.value = cliente.endereco?.bairro || "";

  if (complemento) complemento.value = cliente.endereco?.complemento || "";
}

/* ==========================================================
   FECHAR MODAL
========================================================== */

function fecharModalCliente() {
  const modal = document.getElementById("clienteModal");

  if (modal) {
    const instance = bootstrap.Modal.getInstance(modal);

    instance?.hide();
  }
}

function formatarTelefone(valor) {
  let numero = valor.replace(/\D/g, "");

  // remove excesso
  numero = numero.substring(0, 13);

  // força código do Brasil
  if (!numero.startsWith("55")) {
    numero = "55" + numero;
  }

  numero = numero.substring(0, 13);

  if (numero.length <= 2) {
    return `+${numero}`;
  }

  if (numero.length <= 4) {
    return `+${numero.substring(0, 2)} (${numero.substring(2)}`;
  }

  if (numero.length <= 9) {
    return `+${numero.substring(0, 2)} (${numero.substring(2, 4)}) ${numero.substring(4)}`;
  }

  return `+${numero.substring(0, 2)} (${numero.substring(2, 4)}) ${numero.substring(4, 9)}-${numero.substring(9, 13)}`;
}
