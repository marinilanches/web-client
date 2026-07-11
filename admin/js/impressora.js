import { ouvirPedidos } from "../../js/services/orders.js";

const PRINTER_API = "http://localhost:3002";

const statusImpressora = document.getElementById("statusImpressora");
const filaImpressao = document.getElementById("filaImpressao");
const totalImpressoes = document.getElementById("totalImpressoes");
const ultimaImpressao = document.getElementById("ultimaImpressao");
const historicoImpressao = document.getElementById("historicoImpressao");

const autoPrint = document.getElementById("autoPrint");
const printObs = document.getElementById("printObs");
const printExtras = document.getElementById("printExtras");
const printLogo = document.getElementById("printLogo");

const btnTeste = document.getElementById("btnTeste");
const btnReconectar = document.getElementById("btnReconectar");
const btnLimparFila = document.getElementById("btnLimparFila");

const STORAGE_CONFIG = "mesa_facil_printer_config";
const STORAGE_HISTORY = "mesa_facil_printer_history";
const STORAGE_PRINTED = "mesa_facil_printed_orders";

let historico = [];
let pedidosJaImpressos = [];

/* ==========================================
   CONFIG
========================================== */

function carregarConfig() {
  const salvo = JSON.parse(localStorage.getItem(STORAGE_CONFIG) || "{}");

  autoPrint.checked = salvo.autoPrint ?? true;
  printObs.checked = salvo.printObs ?? true;
  printExtras.checked = salvo.printExtras ?? true;
  printLogo.checked = salvo.printLogo ?? false;
}

function salvarConfig() {
  localStorage.setItem(STORAGE_CONFIG, JSON.stringify({
    autoPrint: autoPrint.checked,
    printObs: printObs.checked,
    printExtras: printExtras.checked,
    printLogo: printLogo.checked
  }));
}

[autoPrint, printObs, printExtras, printLogo].forEach((el) => {
  el?.addEventListener("change", salvarConfig);
});

/* ==========================================
   HISTÓRICO
========================================== */

function carregarHistorico() {
  historico = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || "[]");
  renderHistorico();
}

function salvarHistorico() {
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(historico));
}

function adicionarHistorico(pedido, status = "Impresso") {
  historico.unshift({
    pedidoId: pedido.id || "-",
    cliente: pedido.cliente || "Cliente sem nome",
    status,
    data: new Date().toLocaleString("pt-BR"),
    pedido
  });

  historico = historico.slice(0, 100);
  salvarHistorico();
  renderHistorico();
}

function renderHistorico() {
  if (!historicoImpressao) return;

  if (!historico.length) {
    historicoImpressao.innerHTML = `
      <tr>
        <td colspan="5">Nenhuma impressão registrada.</td>
      </tr>
    `;
    return;
  }

  historicoImpressao.innerHTML = historico.map((item, index) => `
    <tr>
      <td>${item.pedidoId}</td>
      <td>${item.cliente}</td>
      <td>${item.status}</td>
      <td>${item.data}</td>
      <td>
        <button class="btn-reimprimir" data-index="${index}">
          Reimprimir
        </button>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".btn-reimprimir").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = historico[Number(btn.dataset.index)];
      if (!item?.pedido) return;

      await imprimirPedido(item.pedido, true);
    });
  });
}

/* ==========================================
   PEDIDOS JÁ IMPRESSOS
========================================== */

function carregarPedidosJaImpressos() {
  pedidosJaImpressos = JSON.parse(localStorage.getItem(STORAGE_PRINTED) || "[]");
}

function marcarPedidoComoImpresso(id) {
  if (!id) return;

  if (!pedidosJaImpressos.includes(id)) {
    pedidosJaImpressos.push(id);
    localStorage.setItem(STORAGE_PRINTED, JSON.stringify(pedidosJaImpressos));
  }
}

function jaFoiImpresso(id) {
  return pedidosJaImpressos.includes(id);
}

/* ==========================================
   STATUS DO SERVIÇO
========================================== */

async function atualizarStatusServico() {
  try {
    const res = await fetch(`${PRINTER_API}/status`);
    const data = await res.json();

    statusImpressora.textContent = data.online ? "Online" : "Offline";
    filaImpressao.textContent = data.fila ?? 0;
    totalImpressoes.textContent = data.impressosHoje ?? 0;
    ultimaImpressao.textContent = data.ultimaImpressao
      ? new Date(data.ultimaImpressao).toLocaleString("pt-BR")
      : "--";
  } catch (erro) {
    console.error("Erro ao buscar status da impressora:", erro);

    statusImpressora.textContent = "Offline";
    filaImpressao.textContent = "0";
  }
}

/* ==========================================
   PREPARAR DADOS PARA IMPRESSÃO
========================================== */

function montarPedidoParaImpressao(pedido) {

return {

id: pedido.id || null,

numeroPedido:
pedido.numeroPedido || pedido.id || "-",

cliente:
pedido.cliente || "",

telefone:
pedido.telefone || "",

tipo:
pedido.tipo || "Delivery",

bairro:
pedido.bairro || "",

endereco:
pedido.endereco || "",

referencia:
pedido.referencia || "",

pagamentoMetodo:
pedido.pagamentoMetodo || "-",

pagamentoStatus:
pedido.pagamentoStatus || "-",

valorSubtotal:
Number(pedido.valorSubtotal || 0),

taxaEntrega:
Number(pedido.taxaEntrega || 0),

valorTotal:
Number(pedido.valorTotal || 0),

observacoes:
printObs.checked ? pedido.observacoes || "" : "",

itens:
Array.isArray(pedido.itens)
? pedido.itens
: []

};

}

/* ==========================================
   IMPRESSÃO
========================================== */

async function imprimirPedido(pedido, reimpressao = false) {
  try {
    const payload = montarPedidoParaImpressao(pedido);

    const res = await fetch(`${PRINTER_API}/print/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Falha ao imprimir.");
    }

    adicionarHistorico(pedido, reimpressao ? "Reimpresso" : "Impresso");

    if (!reimpressao) {
      marcarPedidoComoImpresso(pedido.id);
    }

    await atualizarStatusServico();
  } catch (erro) {
    console.error("Erro ao imprimir pedido:", erro);
    alert("Erro ao imprimir pedido.");
  }
}

async function imprimirTeste() {
  try {
    const res = await fetch(`${PRINTER_API}/print/test`, {
      method: "POST"
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Erro ao imprimir teste.");
    }

    await atualizarStatusServico();
    alert("Teste enviado para impressão.");
  } catch (erro) {
    console.error(erro);
    alert("Não foi possível imprimir o teste.");
  }
}

async function limparFila() {
  try {
    await fetch(`${PRINTER_API}/queue/clear`, {
      method: "POST"
    });

    await atualizarStatusServico();
    alert("Fila limpa.");
  } catch (erro) {
    console.error(erro);
    alert("Erro ao limpar fila.");
  }
}

/* ==========================================
   OUVIR PEDIDOS E IMPRIMIR AUTOMATICAMENTE
========================================== */

function iniciarAutoPrint() {
  ouvirPedidos((pedidos) => {
    if (!autoPrint.checked) return;

    pedidos.forEach((pedido) => {
      const status = String(pedido.status || "").toUpperCase();

      if (status !== "RECEBIDO") return;
      if (!pedido.id) return;
      if (jaFoiImpresso(pedido.id)) return;

      imprimirPedido(pedido);
    });
  });
}

/* ==========================================
   EVENTOS
========================================== */

btnTeste?.addEventListener("click", imprimirTeste);
btnReconectar?.addEventListener("click", atualizarStatusServico);
btnLimparFila?.addEventListener("click", limparFila);

/* ==========================================
   INIT
========================================== */

carregarConfig();
carregarHistorico();
carregarPedidosJaImpressos();
atualizarStatusServico();
iniciarAutoPrint();

setInterval(atualizarStatusServico, 10000);