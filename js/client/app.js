import { db } from "../services/firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { loadProducts } from "../services/products.js";
import { iniciarCarrinho } from "./cart.js";
import { iniciarCheckout } from "./checkout.js";
import { carregarMaisPedidos } from "./best-sellers.js";
import { iniciarPedidosCliente } from "./orders-client.js";
import { iniciarCliente } from "./customer.js";
import { garantirClienteAuth } from "../services/customers.js";
import { isStoreOpen } from "../services/store-hours.js";

/* ==========================================================
   CONFIG
========================================================== */

const CONFIG_COLLECTION = "configuracoes";
const CONFIG_DOC_ID = "geral";

/* ==========================================================
   HELPERS
========================================================== */

function timeToMinutes(timeString) {
  if (!timeString || typeof timeString !== "string") return null;

  const [hour, minute] = timeString.split(":").map(Number);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return hour * 60 + minute;
}

function isStoreOpen(funcionamento = {}) {
  const statusManual = funcionamento.statusManual || "AUTO";

  if (statusManual === "ABERTA") return true;
  if (statusManual === "FECHADA") return false;

  const abertura = timeToMinutes(funcionamento.abertura);
  const fechamento = timeToMinutes(funcionamento.fechamento);

  // sem horário configurado = aberto
  if (abertura === null || fechamento === null) {
    return true;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // ex.: 19:00 até 23:00
  if (abertura < fechamento) {
    return currentMinutes >= abertura && currentMinutes < fechamento;
  }

  // ex.: 18:00 até 02:00
  if (abertura > fechamento) {
    return currentMinutes >= abertura || currentMinutes < fechamento;
  }

  // abertura == fechamento => 24h
  return true;
}

function verificarCarrinhoAntesCheckout() {
  let carrinho = [];

  try {
    carrinho = JSON.parse(localStorage.getItem("mesaFacilCarrinho")) || [];
  } catch {
    carrinho = [];
  }

  if (!Array.isArray(carrinho) || carrinho.length === 0) {
    alert("Seu carrinho está vazio.\nAdicione itens do cardápio para continuar.");
    return false;
  }

  return true;
}

/* ==========================================================
   UI DA LOJA
========================================================== */

function atualizarInterfaceLoja(config = {}) {
  const statusEl = document.getElementById("status");
  const finalizarBtn = document.getElementById("finalizarBtn");
  const finalizarBtnMobile = document.getElementById("finalizarBtnMobile");
  const tituloLoja = document.querySelector(".topbar h2");

  const nomeLoja = config?.loja?.nome?.trim() || "Restaurante Digital";
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
            : "A loja está fechada no momento."
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
            : "A loja está fechada no momento."
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

    await iniciarPedidosCliente();

  } catch (error) {
    console.error("Erro ao iniciar app do cliente:", error);
  }
});