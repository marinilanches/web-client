import { db } from "../services/firebase.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { loadProducts } from "../services/products.js";
import { iniciarCarrinho } from "./cart.js";
import { iniciarCheckout } from "./checkout.js";
import { carregarMaisPedidos } from "./best-sellers.js";
import { carregarPromocoes } from "./promocoes.js";
import { iniciarPedidosCliente } from "./orders-client.js";
import { iniciarCliente } from "./customer.js";
import { garantirClienteAuth } from "../services/customers.js";
import { isStoreOpen } from "../services/store-hours.js";
import {
  calcularHorarioFinalEstimativa,
  formatarHorarioEstimativa,
  textoDiaEstimativa,
  obterEstimativaPorTipo,
} from "../services/order-estimates.js";

/* ==========================================================
   CONFIG
========================================================== */

const CONFIG_COLLECTION = "configuracoes";
const CONFIG_DOC_ID = "geral";

/* ==========================================================
   HELPERS
========================================================== */

function verificarCarrinhoAntesCheckout() {
  let carrinho = [];

  try {
    carrinho = JSON.parse(localStorage.getItem("mesaFacilCarrinho")) || [];
  } catch {
    carrinho = [];
  }

  if (!Array.isArray(carrinho) || carrinho.length === 0) {
    alert(
      "Seu carrinho está vazio.\nAdicione itens do cardápio para continuar.",
    );
    return false;
  }

  return true;
}

function renderizarEstimativas(config = {}) {
  const retiradaEl =
    document.getElementById("estimativaRetirada");

  const entregaEl =
    document.getElementById("estimativaEntrega");

  const agora = new Date();

  if (retiradaEl) {
    const estimativa =
      obterEstimativaPorTipo(
        config,
        "Retirada",
      );

    const horarioFinal =
      calcularHorarioFinalEstimativa(
        estimativa,
        agora,
      );

    retiradaEl.innerHTML = `
      <div class="card-body p-4">
        <div class="fs-5 fw-bold">
          🛍️ Retirada
        </div>

        <div class="text-secondary mt-2">
          ${textoDiaEstimativa(
            horarioFinal,
            agora,
          )}
        </div>

        <div class="fs-4 fw-bold mt-1">
          ${estimativa.minimo}–${estimativa.maximo} min
        </div>

        <div class="mt-2">
          Pronto para retirar até
          <strong>
            ${formatarHorarioEstimativa(
              horarioFinal,
            )}
          </strong>
        </div>
      </div>
    `;
  }

  if (entregaEl) {
    const estimativa =
      obterEstimativaPorTipo(
        config,
        "Delivery",
      );

    const horarioFinal =
      calcularHorarioFinalEstimativa(
        estimativa,
        agora,
      );

    entregaEl.innerHTML = `
      <div class="card-body p-4">
        <div class="fs-5 fw-bold">
          🚚 Entrega
        </div>

        <div class="text-secondary mt-2">
          ${textoDiaEstimativa(
            horarioFinal,
            agora,
          )}
        </div>

        <div class="fs-4 fw-bold mt-1">
          ${estimativa.minimo}–${estimativa.maximo} min
        </div>

        <div class="mt-2">
          Chegará até
          <strong>
            ${formatarHorarioEstimativa(
              horarioFinal,
            )}
          </strong>
        </div>
      </div>
    `;
  }
}

/* ==========================================================
   UI DA LOJA
========================================================== */

function atualizarInterfaceLoja(config = {}) {
  renderizarEstimativas(config);
  const statusEl = document.getElementById("status");
  const finalizarBtn = document.getElementById("finalizarBtn");
  const finalizarBtnMobile = document.getElementById("finalizarBtnMobile");
  const tituloLoja = document.querySelector(".topbar h2");

  const nomeLoja = config?.loja?.nome?.trim() || "Lanches Marini";
  const funcionamento = config?.funcionamento || {};
  const aberta = isStoreOpen(funcionamento);

  if (tituloLoja) {
    tituloLoja.textContent = `🍔 ${nomeLoja}`;
  }

  if (statusEl) {
    if (aberta) {
      statusEl.textContent = "🟢 Aberto";
      statusEl.title =
        funcionamento.abertura && funcionamento.fechamento
          ? `Funcionando das ${funcionamento.abertura} às ${funcionamento.fechamento}`
          : "Loja aberta";
    } else {
      statusEl.textContent = "🔴 Fechado";
      statusEl.title =
        funcionamento.abertura && funcionamento.fechamento
          ? `Funcionamento: ${funcionamento.abertura} às ${funcionamento.fechamento}`
          : "Loja fechada";
    }
  }

  if (finalizarBtn) {
    finalizarBtn.disabled = false;

    if (!aberta) {
      finalizarBtn.textContent = "Loja fechada no momento";
      finalizarBtn.title =
        funcionamento.abertura && funcionamento.fechamento
          ? `Abre às ${funcionamento.abertura}`
          : "A loja está fechada no momento";
    } else {
      finalizarBtn.textContent = "Finalizar Pedido";
      finalizarBtn.title = "";
    }

    finalizarBtn.onclick = () => {
      if (!aberta) {
        alert(
          funcionamento.abertura && funcionamento.fechamento
            ? `A loja está fechada no momento.\nAbre às ${funcionamento.abertura}.`
            : "A loja está fechada no momento.",
        );
        return;
      }

      if (!verificarCarrinhoAntesCheckout()) return;

      window.location.href = "./pedido.html";
    };
  }

  if (finalizarBtnMobile) {
    finalizarBtnMobile.disabled = false;

    if (!aberta) {
      finalizarBtnMobile.textContent = "Loja fechada no momento";
      finalizarBtnMobile.title =
        funcionamento.abertura && funcionamento.fechamento
          ? `Abre às ${funcionamento.abertura}`
          : "A loja está fechada no momento";
    } else {
      finalizarBtnMobile.textContent = "Finalizar Pedido";
      finalizarBtnMobile.title = "";
    }

    finalizarBtnMobile.onclick = () => {
      if (!aberta) {
        alert(
          funcionamento.abertura && funcionamento.fechamento
            ? `A loja está fechada no momento.\nAbre às ${funcionamento.abertura}.`
            : "A loja está fechada no momento.",
        );
        return;
      }

      if (!verificarCarrinhoAntesCheckout()) return;

      window.location.href = "./pedido.html";
    };
  }
}

/* ==========================================================
   CONFIGURAÇÕES DA LOJA
========================================================== */

async function carregarConfiguracoesLoja() {
  try {
    const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.warn("Documento configuracoes/geral não encontrado.");
      atualizarInterfaceLoja({});
      return;
    }

    const config = snap.data();
    atualizarInterfaceLoja(config);
    console.log("Configurações carregadas:", config);
  } catch (error) {
    console.error("Erro ao carregar configurações da loja:", error);
    atualizarInterfaceLoja({});
  }
}

/* ==========================================================
   INIT
========================================================== */

window.addEventListener("DOMContentLoaded", async () => {
  try {
    await garantirClienteAuth();

    await iniciarCliente();

    await carregarConfiguracoesLoja();

    await loadProducts();

    iniciarCarrinho();

    iniciarCheckout();

    await carregarMaisPedidos();

    await carregarPromocoes();

    await iniciarPedidosCliente();
  } catch (error) {
    console.error("Erro ao iniciar app do cliente:", error);
  }
});