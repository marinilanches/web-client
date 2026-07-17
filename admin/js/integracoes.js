import { toast } from "../components/toast.js";

import {
  buscarConfiguracaoBee,
  salvarConfiguracaoBee,
  solicitarEntregador,
  consultarStatusEntregador,
} from "../../js/services/bee-delivery.js";

/*
==========================================
 ELEMENTOS
==========================================
*/

const beeAtivo = document.getElementById("beeAtivo");

const beeAmbiente = document.getElementById("beeAmbiente");

const beeToken = document.getElementById("beeToken");

const salvarBtn = document.getElementById("salvarIntegracoes");

const solicitarBtn = document.getElementById("solicitarEntrega");

const statusIntegracao = document.getElementById("statusIntegracao");

const statusEntregador = document.getElementById("statusEntregador");

const alterarTokenBtn = document.getElementById("alterarToken");

const atualizarStatusBtn = document.getElementById("atualizarStatus");

// Controle do token
let tokenVisivel = false;

/*
==========================================
 STATUS LABELS
==========================================
*/

const statusEntregaTexto = {
  offline: "Nenhum entregador solicitado",

  procurando: "Procurando entregador",

  encontrado: "Entregador encontrado",

  caminho: "A caminho",

  finalizado: "Finalizado",
};

/*
==========================================
 CARREGAR CONFIGURAÇÃO
==========================================
*/

async function carregar() {
  try {
    const bee = await buscarConfiguracaoBee();

    if (beeAtivo) {
      beeAtivo.checked = bee.ativo ?? false;
    }

    if (beeAmbiente) {
      beeAmbiente.value = bee.ambiente || "teste";
    }

    if (beeToken) {
      if (beeToken) {
        if (bee.token && bee.token !== "XXX") {
          beeToken.value = "••••••••••••";
        } else {
          beeToken.value = "";
        }

        beeToken.readOnly = true;
      }
    }

    atualizarStatusIntegracao(bee);

    atualizarStatusEntregador(bee.entregador);
  } catch (error) {
    console.error("[BEE] Erro ao carregar", error);

    toast("Erro ao carregar integração Bee Delivery.");
  }
}

/*
==========================================
 STATUS INTEGRAÇÃO
==========================================
*/

function atualizarStatusIntegracao(bee) {
  if (!statusIntegracao) return;

  if (!bee.ativo) {
    statusIntegracao.innerHTML = `

            <p>
                <strong>Status:</strong>
                Desconectado
            </p>

        `;

    return;
  }

  statusIntegracao.innerHTML = `

        <p>
            <strong>Status:</strong>
            Conectado
        </p>


        <p>
            <strong>Ambiente:</strong>
            ${bee.ambiente || "-"}
        </p>

    `;
}

/*
==========================================
 STATUS ENTREGADOR
==========================================
*/

function atualizarStatusEntregador(entregador = {}) {
  if (!statusEntregador) return;

  const status = entregador.status || "offline";

  statusEntregador.innerHTML = `


        <p>

            <strong>Status:</strong>

            ${statusEntregaTexto[status] || status}

        </p>



        <p>

            <strong>Nome:</strong>

            ${entregador.nome || "-"}

        </p>



        <p>

            <strong>Telefone:</strong>

            ${entregador.telefone || "-"}

        </p>



    `;
}

/*
==========================================
 SALVAR
==========================================
*/

async function salvar() {
  try {
    await salvarConfiguracaoBee({
      ativo: beeAtivo.checked,

      ambiente: beeAmbiente.value,

      token: beeToken.value === "••••••••••••" ? undefined : beeToken.value,
    });

    toast("Integração salva com sucesso!");

    carregar();
  } catch (error) {
    console.error(error);

    toast("Erro ao salvar integração.");
  }
}

/*
==========================================
 SOLICITAR ENTREGADOR
==========================================
*/

async function solicitar() {
  try {
    const pedidoId = prompt("ID do pedido:");

    const resposta = await solicitarEntregador(pedidoId);

    if (resposta.success) {
      await salvarConfiguracaoBee({
        entregador: {
          status: resposta.entregador.status,

          nome: "",

          telefone: "",

          id: "",
        },
      });

      toast(resposta.message);

      carregar();
    }
  } catch (error) {
    console.error(error);

    toast("Erro ao solicitar entregador.");
  }
}

/*
==========================================
 CONSULTAR STATUS
==========================================
*/

async function consultarStatus() {
  try {
    const pedidoId = prompt("ID do pedido:");

    const resposta = await consultarStatusEntregador(pedidoId);

    await salvarConfiguracaoBee({
      entregador: resposta.entregador,
    });

    atualizarStatusEntregador(resposta.entregador);
  } catch (error) {
    console.error(error);
  }
}

/*
==========================================
 EVENTOS
==========================================
*/

salvarBtn?.addEventListener("click", salvar);

solicitarBtn?.addEventListener("click", solicitar);

alterarTokenBtn?.addEventListener("click", () => {
  tokenVisivel = !tokenVisivel;

  beeToken.readOnly = !tokenVisivel;

  if (tokenVisivel) {
    beeToken.value = "";

    beeToken.type = "text";

    alterarTokenBtn.innerHTML = "💾 Confirmar alteração";
  } else {
    beeToken.type = "password";

    beeToken.value = "••••••••••••";

    alterarTokenBtn.innerHTML = "🔑 Alterar token";
  }
});

atualizarStatusBtn?.addEventListener("click", consultarStatus);

/*
==========================================
 INIT
==========================================
*/

console.log("integracoes.js carregado");

carregar();
