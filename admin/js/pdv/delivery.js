// admin/js/pdv/delivery.js

import { toast } from "../../components/toast.js";

import { isDelivery } from "./tipoPedido.js";

import { definirTaxaEntrega } from "./carrinho.js";

import {
  buscarEnderecos,
  buscarDetalhesEndereco,
  calcularDistanciaBee,
  buscarCoordenadasEnderecoCompleto,
} from "../../../js/services/address-search.js";

import { db } from "../../../js/services/firebase.js";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ==========================================================
   ELEMENTOS
========================================================== */

const campoEndereco = document.getElementById("enderecoEntregaPDV");

const campoRua = document.getElementById("ruaPDV");

const campoNumero = document.getElementById("numeroPDV");

const campoCep = document.getElementById("cepPDV");

const campoComplemento = document.getElementById("complementoPDV");

const campoReferencia = document.getElementById("referenciaPDV");

const campoDistancia = document.getElementById("distanciaEntregaPDV");

const campoLatitude = document.getElementById("latitudePDV");

const campoLongitude = document.getElementById("longitudePDV");

const campoBairro = document.getElementById("bairroPDV");

const sugestoesRua = document.getElementById("ruaSugestoesPDV");

/* ==========================================================
   ESTADO
========================================================== */

let taxaEntregaAtual = 0;

let timeoutRua = null;

let enderecoEntrega = {
  cep: "",

  bairro: "",

  rua: "",

  numero: "",

  complemento: "",

  referencia: "",

  latitude: null,

  longitude: null,

  distanciaKm: null,
};

/* ==========================================================
   CONFIGURAÇÃO
========================================================== */

function calcularTaxaPorDistancia(distanciaKm) {

  const faixas =
    configuracoesLoja?.delivery?.configuracaoEntrega?.faixas || [];


  for (const faixa of faixas) {

    if (distanciaKm <= faixa.limiteKm) {

      return faixa.taxa;

    }

  }


  return null;

}

/* ==========================================================
   TAXA POR BAIRRO
========================================================== */

async function buscarBairroPorNome(nome) {
  if (!nome) return null;

  const nomeNormalizado = nome.trim().toLowerCase();

  const ref = collection(db, "taxasEntrega");

  const snapshot = await getDocs(ref);

  let encontrado = null;

  snapshot.forEach((doc) => {
    const dados = doc.data();

    if (
      String(dados.nome || "")
        .trim()
        .toLowerCase() === nomeNormalizado
    ) {
      encontrado = {
        id: doc.id,
        ...dados,
      };
    }
  });

  return encontrado;
}

async function cadastrarBairroAutomaticamente(nome, taxa, distanciaKm) {
  if (!nome || taxa == null) return;

  const existente = await buscarBairroPorNome(nome);

  // bairro já cadastrado
  if (existente) {
    const taxaAtual = Number(existente.taxa || 0);

    // só aumenta se a nova taxa for maior
    if (Number(taxa) > taxaAtual) {
      await updateDoc(doc(db, "taxasEntrega", existente.id), {
        taxa: Number(taxa),
        distanciaKm: Number(distanciaKm),
        atualizadoEm: serverTimestamp(),
      });

      console.log("Taxa do bairro atualizada:", nome, taxaAtual, "->", taxa);
    }

    return;
  }

  // bairro novo
  await addDoc(collection(db, "taxasEntrega"), {
    nome: nome.trim(),

    taxa: Number(taxa),
    distanciaKm: Number(distanciaKm),

    ativo: true,

    ordem: Date.now(),

    ruas: [],

    criadoEm: serverTimestamp(),

    atualizadoEm: serverTimestamp(),
  });

  console.log("Novo bairro salvo:", nome, taxa);
}

/* ==========================================================
   INIT
========================================================== */

export async function initDelivery() {
  bindEventos();

  atualizarInterface();
}

/* ==========================================================
   EVENTOS
========================================================== */

function bindEventos() {
  campoRua?.addEventListener("input", () => {
    atualizarEndereco();

    clearTimeout(timeoutRua);

    timeoutRua = setTimeout(pesquisarEndereco, 300);
  });

  campoBairro?.addEventListener("input", atualizarEndereco);

  campoCep?.addEventListener("input", () => {
    formatarCEP();
  });

  campoCep?.addEventListener("blur", () => {
    buscarCEP();
  });

  campoNumero?.addEventListener("input", async () => {
    atualizarEndereco();

    await calcularTaxaEntrega();
  });

  campoComplemento?.addEventListener("input", atualizarEndereco);

  campoReferencia?.addEventListener("input", atualizarEndereco);
}

/* ==========================================================
   INTERFACE
========================================================== */

function atualizarInterface() {
  if (!campoEndereco) {
    return;
  }

  campoEndereco.style.display = isDelivery() ? "block" : "none";
}

/* ==========================================================
   AUTOCOMPLETE
========================================================== */

async function pesquisarEndereco() {
  const texto = campoRua.value.trim();

  if (texto.length < 3) {
    fecharSugestoes();

    return;
  }

  try {
    const resultados = await buscarEnderecos(texto);

    renderizarSugestoes(resultados);
  } catch (erro) {
    console.error("Erro ao buscar endereço:", erro);
  }
}

function renderizarSugestoes(resultados) {
  if (!sugestoesRua) {
    return;
  }

  sugestoesRua.innerHTML = "";

  resultados.forEach((item) => {
    const div = document.createElement("div");

    div.className = "autocomplete-item";

    div.innerHTML = `

                <strong>
                    ${item.rua}
                </strong>

                <small>
                    ${item.cidade} - ${item.estado}
                </small>

            `;

    div.onclick = async () => {
      campoRua.value = item.rua || "";

      enderecoEntrega.latitude = Number(item.latitude);

      enderecoEntrega.longitude = Number(item.longitude);

      if (campoLatitude) {
        campoLatitude.value = enderecoEntrega.latitude;
      }

      if (campoLongitude) {
        campoLongitude.value = enderecoEntrega.longitude;
      }

      try {
        const detalhes = await buscarDetalhesEndereco(
          item.latitude,
          item.longitude,
        );

        enderecoEntrega.bairro = detalhes.bairro || "";

        if (campoBairro) {
          campoBairro.value = enderecoEntrega.bairro;
        }
      } catch (erro) {
        console.error("Erro detalhes endereço:", erro);
      }

      atualizarEndereco();

      await calcularTaxaEntrega();

      fecharSugestoes();

      campoNumero?.focus();
    };

    sugestoesRua.appendChild(div);
  });
}

function fecharSugestoes() {
  if (!sugestoesRua) {
    return;
  }

  sugestoesRua.innerHTML = "";
}

/* ==========================================================
   DISTÂNCIA
========================================================== */

async function calcularTaxaEntrega() {

  const coordenadas = await buscarCoordenadasEnderecoCompleto({
    rua: enderecoEntrega.rua,
    numero: enderecoEntrega.numero || "S/N",
    bairro: enderecoEntrega.bairro,
    cidade: "Capivari",
    estado: "SP",
  });


  if (coordenadas) {

    enderecoEntrega.latitude = coordenadas.latitude;

    enderecoEntrega.longitude = coordenadas.longitude;

  }


  const distancia = await calcularDistanciaBee({
    origem: {
      latitude: -23.000761054962886,
      longitude: -47.51735362883598
    },

    destino: {
      latitude: enderecoEntrega.latitude,
      longitude: enderecoEntrega.longitude
    }
  });


  const taxa = calcularTaxaPorDistancia(distancia);


  taxaEntregaAtual = taxa;

  enderecoEntrega.distanciaKm = distancia;


  if (campoDistancia) {

    campoDistancia.textContent =
      `Distância: ${distancia.toFixed(2)} km • Taxa: R$ ${taxa.toFixed(2)}`;

  }


  definirTaxaEntrega(taxa);


  await cadastrarBairroAutomaticamente(
    enderecoEntrega.bairro,
    taxa,
    distancia
  );

}

async function buscarCEP() {
  const cep = campoCep.value.replace(/\D/g, "");

  if (cep.length !== 8) {
    return;
  }

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

    const dados = await resposta.json();

    if (dados.erro) {
      return;
    }

    campoRua.value = dados.logradouro || "";

    campoBairro.value = dados.bairro || "";

    atualizarEndereco();

    // busca coordenadas para calcular taxa
    const resultados = await buscarEnderecos(
      `${dados.logradouro}, ${dados.bairro}`,
    );

    if (resultados.length) {
      const endereco = resultados[0];

      enderecoEntrega.latitude = Number(endereco.latitude);

      enderecoEntrega.longitude = Number(endereco.longitude);

      await calcularTaxaEntrega();
    }
  } catch (erro) {
    console.error("Erro CEP:", erro);
  }
}

/* ==========================================================
   CEP
========================================================== */

function formatarCEP() {
  let valor = campoCep.value.replace(/\D/g, "");

  valor = valor.substring(0, 8);

  if (valor.length > 5) {
    valor = valor.substring(0, 5) + "-" + valor.substring(5);
  }

  campoCep.value = valor;

  atualizarEndereco();
}

/* ==========================================================
   ENDEREÇO
========================================================== */

function atualizarEndereco() {
  enderecoEntrega.rua = campoRua?.value || "";

  enderecoEntrega.bairro = campoBairro?.value || "";

  enderecoEntrega.numero = campoNumero?.value || "";

  enderecoEntrega.cep = campoCep?.value || "";

  enderecoEntrega.complemento = campoComplemento?.value || "";

  enderecoEntrega.referencia = campoReferencia?.value || "";
}

export function definirEnderecoEntrega(dados = {}) {
  enderecoEntrega = {
    ...enderecoEntrega,
    ...dados,
  };

  if (enderecoEntrega.latitude && enderecoEntrega.longitude) {
    calcularTaxaEntrega();
  }
}

/* ==========================================================
   GETTERS
========================================================== */

export function getTaxaEntrega() {
  return taxaEntregaAtual;
}

export function getEnderecoEntrega() {
  return {
    ...enderecoEntrega,
  };
}

/* ==========================================================
   VALIDAÇÃO
========================================================== */

export function validarEntrega() {
  if (!isDelivery()) {
    return true;
  }

  if (!enderecoEntrega.rua || !enderecoEntrega.numero) {
    toast("Informe o endereço de entrega.");

    return false;
  }

  if (enderecoEntrega.latitude == null || enderecoEntrega.longitude == null) {
    toast("Selecione o endereço pela busca para calcular a entrega.");

    return false;
  }

  if (enderecoEntrega.distanciaKm == null) {
    toast("Calcule a distância da entrega.");

    return false;
  }

  return true;
}

/* ==========================================================
   LIMPEZA
========================================================== */

export function limparEnderecoEntrega() {
  enderecoEntrega = {
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    referencia: "",
    latitude: null,
    longitude: null,
    distanciaKm: null,
  };

  [
    campoRua,
    campoNumero,
    campoCep,
    campoBairro,
    campoComplemento,
    campoReferencia,
    campoLatitude,
    campoLongitude,
  ].forEach((campo) => {
    if (campo) {
      campo.value = "";
    }
  });

  if (campoDistancia) {
    campoDistancia.textContent = "Distância: -- km";
  }

  taxaEntregaAtual = 0;

  definirTaxaEntrega(0);
}

/* ==========================================================
   PREENCHER ENDEREÇO CLIENTE
========================================================== */

export function preencherEnderecoCliente(cliente = {}) {
  if (!cliente) {
    return;
  }

  definirEnderecoEntrega({
    cep: cliente.cep || "",

    rua: cliente.rua || "",

    numero: cliente.numero || "",

    complemento: cliente.complemento || "",

    referencia: cliente.referencia || "",

    latitude: cliente.latitude ?? null,

    longitude: cliente.longitude ?? null,
  });

  if (campoRua) {
    campoRua.value = cliente.rua || "";
  }

  if (campoNumero) {
    campoNumero.value = cliente.numero || "";
  }

  if (campoCep) {
    campoCep.value = cliente.cep || "";
  }

  if (campoComplemento) {
    campoComplemento.value = cliente.complemento || "";
  }

  if (campoReferencia) {
    campoReferencia.value = cliente.referencia || "";
  }

  if (campoLatitude) {
    campoLatitude.value = cliente.latitude || "";
  }

  if (campoLongitude) {
    campoLongitude.value = cliente.longitude || "";
  }

  if (cliente.latitude && cliente.longitude) {
    calcularTaxaEntrega();
  }
}

export function limparDelivery() {
  limparEnderecoEntrega();

  atualizarInterface();
}

export function atualizarDelivery() {
  atualizarInterface();
}