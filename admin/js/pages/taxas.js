import { db } from "../../../js/services/firebase.js";

import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const REF = doc(db, "configuracoes", "geral");

const lista = document.getElementById("listaDistancias");

const btnSalvar = document.getElementById("btnSalvar");

const btnAdicionarDistancia = document.getElementById("btnAdicionarDistancia");

const tempoEntrega = document.getElementById("tempoEntrega");

const raioMaximo = document.getElementById("raioMaximo");

let modoEntrega = "PROPRIA";

let configuracoesEntrega = {
  PROPRIA: {
    tempo: 50,
    raio: 7,
    faixas: [],
  },

  SOB_DEMANDA: {
    tempo: 50,
    raio: 7,
    faixas: [],
  },
};

let faixas = [];

function renderizar() {
  lista.innerHTML = "";

  faixas.forEach((item, index) => {
    lista.innerHTML += `

    <tr>

      <td>
        Até ${Number(item.limiteKm).toString()} km
      </td>


      <td>

        ${tempoEntrega.value}
        min

      </td>


      <td>

        <input
          type="number"
          value="${item.taxa}"
          data-index="${index}"
          class="inputTaxa"
        >

      </td>


      <td>

        <button
          type="button"
          class="btn btn-danger btnRemoverDistancia"
          data-index="${index}"
        >
          🗑
        </button>

      </td>


    </tr>

    `;
  });

  document.querySelectorAll(".btnRemoverDistancia").forEach((botao) => {
    botao.addEventListener("click", () => {
      const index = Number(botao.dataset.index);

      faixas.splice(index, 1);

      renderizar();
    });
  });
}

function aplicarModo() {
  const config = configuracoesEntrega[modoEntrega];

  if (!config) return;

  tempoEntrega.value = config.tempo ?? 50;

  raioMaximo.value = config.raio ?? 7;

  faixas = structuredClone(config.faixas || []);

  document
    .getElementById("btnEntregaPropria")
    .classList.toggle("ativo", modoEntrega === "PROPRIA");

  document
    .getElementById("btnSobDemanda")
    .classList.toggle("ativo", modoEntrega === "SOB_DEMANDA");

  renderizar();
}

async function carregar() {
  const snap = await getDoc(REF);

  if (snap.exists()) {
    const dados = snap.data();

    const delivery = dados.delivery || {};

    modoEntrega = delivery.modoEntrega || "PROPRIA";

    configuracoesEntrega.PROPRIA = delivery.configuracaoEntregaPropria ||
      delivery.configuracaoEntrega || {
        tempo: 50,
        raio: 7,
        faixas: [],
      };

    configuracoesEntrega.SOB_DEMANDA =
      delivery.configuracaoEntregaSobDemanda || {
        tempo: 50,
        raio: 7,
        faixas: [],
      };

    aplicarModo();
  }

  renderizar();
}

async function salvar() {
  document.querySelectorAll(".inputTaxa").forEach((input) => {
    const index = Number(input.dataset.index);

    faixas[index].taxa = Number(input.value);
  });

  configuracoesEntrega[modoEntrega] = {
    tempo: Number(tempoEntrega.value),
    raio: Number(raioMaximo.value),
    faixas: structuredClone(faixas),
  };

  await setDoc(
    REF,
    {
      delivery: {
        modoEntrega,

        configuracaoEntrega: configuracoesEntrega[modoEntrega],

        configuracaoEntregaPropria: configuracoesEntrega.PROPRIA,

        configuracaoEntregaSobDemanda: configuracoesEntrega.SOB_DEMANDA,
      },
    },

    {
      merge: true,
    },
  );

  alert("Configuração salva!");
}

btnAdicionarDistancia.addEventListener("click", () => {
  const distancia = prompt("Distância em km:");

  if (!distancia) return;

  const taxa = prompt("Valor da taxa:");

  if (!taxa) return;

  faixas.push({
    limiteKm: Number(distancia),

    taxa: Number(taxa),
  });

  faixas.sort((a, b) => a.limiteKm - b.limiteKm);

  renderizar();
});

btnSalvar.addEventListener("click", salvar);

document.getElementById("btnEntregaPropria").addEventListener("click", () => {
  configuracoesEntrega[modoEntrega] = {
    tempo: Number(tempoEntrega.value),
    raio: Number(raioMaximo.value),
    faixas: structuredClone(faixas),
  };

  modoEntrega = "PROPRIA";

  aplicarModo();
});

document.getElementById("btnSobDemanda").addEventListener("click", () => {
  configuracoesEntrega[modoEntrega] = {
    tempo: Number(tempoEntrega.value),
    raio: Number(raioMaximo.value),
    faixas: structuredClone(faixas),
  };

  modoEntrega = "SOB_DEMANDA";

  aplicarModo();
});

carregar();
