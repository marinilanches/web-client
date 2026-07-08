import { db } from "../services/firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { loadProducts } from "../services/products.js";
import { iniciarCarrinho } from "./cart.js";
import { iniciarCheckout } from "./checkout.js";

const CONFIG_COLLECTION = "configuracoes";
const CONFIG_DOC_ID = "geral";

function timeToMinutes(timeString) {
  if (!timeString || typeof timeString !== "string") return null;

  const [hour, minute] = timeString.split(":").map(Number);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return hour * 60 + minute;
}

function isStoreOpen(funcionamento = {}) {
  const statusManual = funcionamento.statusManual || "AUTO";

  // prioridade para o status manual
  if (statusManual === "ABERTA") return true;
  if (statusManual === "FECHADA") return false;

  const abertura = timeToMinutes(funcionamento.abertura);
  const fechamento = timeToMinutes(funcionamento.fechamento);

  // se não houver horário configurado, assume aberto
  if (abertura === null || fechamento === null) {
    return true;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // exemplo: 19:15 -> 23:00
  if (abertura < fechamento) {
    return currentMinutes >= abertura && currentMinutes < fechamento;
  }

  // exemplo: 18:00 -> 02:00 (vira a meia-noite)
  if (abertura > fechamento) {
    return currentMinutes >= abertura || currentMinutes < fechamento;
  }

  // abertura == fechamento -> considera 24h
  return true;
}

function atualizarInterfaceLoja(config) {
  const statusEl = document.getElementById("status");
  const finalizarBtn = document.getElementById("finalizarBtn");
  const tituloLoja = document.querySelector(".topbar h2");

  const nomeLoja = config?.loja?.nome?.trim() || "Restaurante Digital";
  const funcionamento = config?.funcionamento || {};
  const aberta = isStoreOpen(funcionamento);

  // atualiza nome da loja no topo
  if (tituloLoja) {
    tituloLoja.textContent = `🍔 ${nomeLoja}`;
  }

  // atualiza status visual
  if (statusEl) {
    if (aberta) {
      statusEl.textContent = "🟢 Aberto";
      statusEl.title = funcionamento.abertura && funcionamento.fechamento
        ? `Funcionando das ${funcionamento.abertura} às ${funcionamento.fechamento}`
        : "Loja aberta";
    } else {
      statusEl.textContent = "🔴 Fechado";
      statusEl.title = funcionamento.abertura && funcionamento.fechamento
        ? `Funcionamento: ${funcionamento.abertura} às ${funcionamento.fechamento}`
        : "Loja fechada";
    }
  }

  // bloqueia finalizar pedido se estiver fechado
  if (finalizarBtn) {
    finalizarBtn.disabled = !aberta;

    if (!aberta) {
      finalizarBtn.textContent = "Loja fechada no momento";
      finalizarBtn.title = funcionamento.abertura && funcionamento.fechamento
        ? `Abre às ${funcionamento.abertura}`
        : "A loja está fechada no momento";
    } else {
      finalizarBtn.textContent = "Finalizar Pedido";
      finalizarBtn.title = "";
    }
  }
}

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
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  await carregarConfiguracoesLoja();
  await loadProducts();
  iniciarCarrinho();
  iniciarCheckout();
});