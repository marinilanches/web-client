import { buscarCliente, salvarCliente } from "../services/customers.js";

import {
  buscarBairrosPorNome
} from "../services/delivery-fees.js";

export async function iniciarCliente() {
  const cliente = await buscarCliente();

  if (cliente) {
    preencherCampos(cliente);
  }

  const btn = document.getElementById("salvarClienteBtn");

  if (btn) {
    btn.addEventListener("click", salvarDadosCliente);
  }
}

async function salvarDadosCliente() {
  const nome = document.getElementById("clienteNome")?.value;

  const telefone = document.getElementById("clienteTelefone")?.value;

  const observacoes =
    document.getElementById("clienteObservacoes")?.value || "";

  const endereco = {
    rua: document.getElementById("clienteRua")?.value || "",

    numero: document.getElementById("clienteNumero")?.value || "",

    bairro: document.getElementById("clienteBairro")?.value || "",

    complemento: document.getElementById("clienteComplemento")?.value || "",
  };

  if (!nome || !telefone) {
    alert("Informe nome e telefone");

    return;
  }

  // ==========================================
  // VERIFICA BAIRRO
  // ==========================================

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

function preencherCampos(cliente) {
  const nome = document.getElementById("clienteNome");

  const telefone = document.getElementById("clienteTelefone");

  const observacoes = document.getElementById("clienteObservacoes");

  const rua = document.getElementById("clienteRua");

  const numero = document.getElementById("clienteNumero");

  const bairro = document.getElementById("clienteBairro");

  const complemento = document.getElementById("clienteComplemento");

  if (nome) nome.value = cliente.nome || "";

  if (telefone) telefone.value = cliente.telefone || "";

  if (observacoes) observacoes.value = cliente.observacoes || "";

  if (rua) rua.value = cliente.endereco?.rua || "";

  if (numero) numero.value = cliente.endereco?.numero || "";

  if (bairro) bairro.value = cliente.endereco?.bairro || "";

  if (complemento) complemento.value = cliente.endereco?.complemento || "";
}

function fecharModalCliente() {
  const modal = document.getElementById("clienteModal");

  if (modal) {
    const instance = bootstrap.Modal.getInstance(modal);

    instance?.hide();
  }
}
