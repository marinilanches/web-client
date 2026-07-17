import { abrirModal, fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

import {
  ouvirPedidos,
  criarPedido,
  alterarStatus,
  cancelarPedido,
  marcarComoImpresso,
  atualizarEntregadorPedido,
} from "../../js/services/orders.js";

import { solicitarEntregador } from "../../js/services/bee-delivery.js";

/* ==========================================
   ELEMENTOS
========================================== */

const listaPedidos = document.getElementById("listaPedidos");
const btnNovoPedido = document.getElementById("novoPedido");
const filtroStatus = document.getElementById("filtroStatus");
const buscarPedido = document.getElementById("buscarPedido");

/* ==========================================
ESTADO
========================================== */

let pedidosCache = [];

/* ==========================================
   INIT
========================================== */

console.log("pedidos.js carregado");

ouvirPedidos((pedidos) => {
  pedidosCache = pedidos;

  aplicarFiltros();
});

/* ==========================================
   FILTROS
========================================== */

filtroStatus?.addEventListener("change", aplicarFiltros);
buscarPedido?.addEventListener("input", aplicarFiltros);

function aplicarFiltros() {
  let pedidos = [...pedidosCache];

  pedidos = pedidos.filter((p) => String(p.numeroPedido) !== "2600");

  const statusSelecionado = filtroStatus?.value?.trim() || "";
  const termoBusca = buscarPedido?.value?.trim().toLowerCase() || "";

  if (statusSelecionado) {
    pedidos = pedidos.filter((p) => p.status === statusSelecionado);
  }

  if (termoBusca) {
    pedidos = pedidos.filter((p) => {
      const cliente = (p.cliente || "").toLowerCase();
      const telefone = (p.telefone || "").toLowerCase();
      const tipo = (p.tipo || "").toLowerCase();

      return (
        cliente.includes(termoBusca) ||
        telefone.includes(termoBusca) ||
        tipo.includes(termoBusca)
      );
    });
  }

  renderPedidos(pedidos);
}

/* ==========================================
   RENDER PEDIDOS
========================================== */

function renderPedidos(pedidos) {
  if (!listaPedidos) return;

  if (!pedidos.length) {
    listaPedidos.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum pedido encontrado</h3>
                <p>Os pedidos aparecerão aqui automaticamente.</p>
            </div>
        `;
    return;
  }

  listaPedidos.innerHTML = "";

  pedidos.sort((a, b) => {
    if (a.status === "RECEBIDO" && b.status !== "RECEBIDO") return -1;

    if (a.status !== "RECEBIDO" && b.status === "RECEBIDO") return 1;

    const dataA = a.criadoEm?.seconds || 0;
    const dataB = b.criadoEm?.seconds || 0;

    return dataB - dataA;
  });

  pedidos.forEach((pedido) => {
    const card = document.createElement("div");

    card.className =
      pedido.status === "RECEBIDO" ? "panel pedido-novo" : "panel";

    card.innerHTML = `
            <div class="panel-title">
                Pedido #${pedido.numeroPedido || pedido.id?.slice(0, 6) || "-"}
            </div>

            <p>
                <strong>Cliente:</strong>
                ${pedido.cliente || "Cliente sem nome"}
            </p>

            <p>
                <strong>Status:</strong>
                ${pedido.status || "-"}
            </p>

            <p>
              <strong>Telefone:</strong>
              ${pedido.telefone || pedido.telefoneWhatsapp || "-"}
            </p>

            <p>
                <strong>Tipo:</strong>
                ${pedido.tipo || "-"}
            </p>

            <p>
                <strong>Total:</strong>
                R$ ${Number(pedido.valorTotal || 0).toFixed(2)}
            </p>

            ${
              pedido.pagamentoMetodo === "DINHEIRO"
                ? `
                        ${
                          Number(pedido.trocoPara || 0) > 0
                            ? `
                                <p>
                                    <strong>CLIENTE PAGA:</strong>
                                    R$ ${Number(pedido.trocoPara).toFixed(2)}
                                </p>

                                <p>
                                    <strong>TROCO:</strong>
                                    R$ ${(Number(pedido.trocoPara) - Number(pedido.valorTotal || 0)).toFixed(2)}
                                </p>
                                `
                            : `
                                <p>
                                    <strong>TROCO:</strong>
                                    Cliente informou que possui trocado.
                                </p>
                                `
                        }
                    `
                : ""
            }

            <p>
                <strong>Observações:</strong>
                ${pedido.observacoes || "-"}
            </p>

            <div class="modal-actions pedido-actions">

                <button 
                    class="btn btn-secondary btn-detalhes"
                    data-id="${pedido.id}">
                    🔎 Detalhes
                </button>

                <button class="btn btn-secondary btn-preparando" data-id="${pedido.id}">
                    👨‍🍳 Preparando
                </button>

                <button class="btn btn-primary btn-pronto" data-id="${pedido.id}">
                    ✅ Pronto
                </button>

                <button class="btn btn-primary btn-entregue" data-id="${pedido.id}">
                    🚚 Entregue
                </button>

                <button class="btn btn-danger btn-cancelar" data-id="${pedido.id}">
                    ❌ Cancelar
                </button>

            </div>
        `;

    listaPedidos.appendChild(card);
  });

  bindAcoesPedidos();
}

/* ==========================================
   AÇÕES DOS PEDIDOS
========================================== */

function abrirDetalhesPedido(id) {
  const pedido = pedidosCache.find((p) => p.id === id);

  console.log("PEDIDO COMPLETO:", pedido);
  console.log("TROCO PARA:", pedido.trocoPara);
  console.log("VALOR TOTAL:", pedido.valorTotal);
  console.log("METODO:", pedido.pagamentoMetodo);

  if (!pedido) {
    toast("Pedido não encontrado");
    return;
  }

  const itensHTML = (pedido.itens || [])
    .map((item) => {
      const adicionais = (item.adicionais || [])
        .map((a) => `${a.nome} (+R$ ${Number(a.preco || 0).toFixed(2)})`)
        .join("<br>");

      return `
            <div class="item-pedido">

                <strong>
                    ${item.nome}
                </strong>

                <p>
                    Quantidade: ${item.quantidade}
                </p>

                <p>
                    Valor unitário:
                    R$ ${Number(item.valorUnitario || 0).toFixed(2)}
                </p>

                ${
                  adicionais
                    ? `<p>
                        <strong>Adicionais:</strong><br>
                        ${adicionais}
                    </p>`
                    : ""
                }


                ${
                  item.observacaoItem && item.observacaoItem.trim()
                    ? `
                    <p>
                        <strong>📝 Observação:</strong><br>
                        ${item.observacaoItem}
                    </p>
                    `
                    : ""
                }


                <hr>

            </div>
        `;
    })
    .join("");

  abrirModal(
    `Pedido #${pedido.numeroPedido}`,
    `

        <div>

            <h3>👤 Cliente</h3>

            <p>
                ${pedido.cliente}
            </p>

            <p>
              📞 ${pedido.telefone || pedido.telefoneWhatsapp || "-"}
            </p>


            <h3>📦 Tipo</h3>

            <p>
                ${pedido.tipo}
            </p>

            ${
              pedido.tipo === "Delivery"
                ? `
                <h3>🚚 Entrega</h3>

                ${
                  pedido.entrega
                    ? `

                <h3>🚚 Bee Delivery</h3>

                <p>

                <strong>Status:</strong><br>

                ${pedido.entrega.statusDescricao || pedido.entrega.status || "-"}

                </p>

                <p>

                <strong>Código:</strong><br>

                ${pedido.entrega.id || "-"}

                </p>

                <p>

                <strong>Previsão:</strong><br>

                ${
                  pedido.entrega.previsaoMinutos
                    ? `${pedido.entrega.previsaoMinutos} min`
                    : "-"
                }

                </p>

                <p>

                <strong>Entregador:</strong><br>

                ${pedido.entrega.entregador?.nome || "-"}

                </p>

                <p>

                <strong>Telefone:</strong><br>

                ${pedido.entrega.entregador?.telefone || "-"}

                </p>

                ${
                  pedido.entrega.trackingUrl
                    ? `

                <p>

                <a
                href="${pedido.entrega.trackingUrl}"
                target="_blank">

                📍 Acompanhar entrega

                </a>

                </p>

                `
                    : ""
                }

                `
                    : ""
                }

                <p>
                    <strong>Bairro:</strong><br>
                    ${pedido.bairro || "-"}
                </p>

                <p>
                    <strong>CEP:</strong><br>
                    ${pedido.endereco?.cep || "-"}
                </p>

                <p>
                    <strong>Endereço:</strong><br>
                    ${pedido.endereco?.rua || "-"}${pedido.endereco?.numero ? `, ${pedido.endereco.numero}` : ""}
                </p>

                <p>
                    <strong>Referência:</strong><br>
                    ${pedido.endereco?.complemento || pedido.referencia || "—"}
                </p>
                `
                : ""
            }


            <h3>🍔 Itens</h3>

            ${itensHTML || "Nenhum item"}


            <h3>💰 Pagamento</h3>

            <p>
                Método:
                ${pedido.pagamentoMetodo || "-"}
            </p>


            <p>
                Status:
                ${pedido.pagamentoStatus || "-"}
            </p>

            <h3>Total</h3>

            <h2>
                R$ ${Number(pedido.valorTotal || 0).toFixed(2)}
            </h2>

            <div class="modal-actions mt-3">


              ${
                pedido.tipo === "Delivery" && !pedido.entrega
                  ? `
                <button
                    type="button"
                    class="btn btn-secondary"
                    id="btnSolicitarEntregador">

                    🚚 Solicitar entregador

                </button>
                `
                  : ""
              }



              <button
                  type="button"
                  class="btn btn-primary"
                  id="btnImprimirComanda">

                  🖨️ Imprimir comanda

              </button>


            </div>

            ${
              pedido.observacoes
                ? `
                <h3>Observações</h3>
                <p>${pedido.observacoes}</p>
                `
                : ""
            }


        </div>

        `,
  );

  document
    .getElementById("btnImprimirComanda")
    ?.addEventListener("click", async () => {
      await enviarParaImpressora(pedido);
    });

  document
    .getElementById("btnSolicitarEntregador")
    ?.addEventListener("click", async () => {
      try {
        const resposta = await solicitarEntregador(pedido);

        if (resposta.success) {
          await atualizarEntregadorPedido(
            pedido.id,

            resposta.entrega,
          );

          toast("🚚 Entregador solicitado!");

          fecharModal();
        }
      } catch (error) {
        console.error(error);

        toast("Erro ao solicitar entregador.");
      }
    });
} // <-- FECHA abrirDetalhesPedido AQUI

function bindAcoesPedidos() {
  document.querySelectorAll(".btn-detalhes").forEach((btn) => {
    btn.addEventListener("click", () => {
      abrirDetalhesPedido(btn.dataset.id);
    });
  });
  document.querySelectorAll(".btn-preparando").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const pedido = pedidosCache.find((p) => p.id === btn.dataset.id);

        if (!pedido) {
          toast("Pedido não encontrado");
          return;
        }

        // muda status
        await alterarStatus(pedido.id, "PREPARANDO");

        // imprime somente uma vez
        if (!pedido.impresso) {
          await enviarParaImpressora(pedido);

          // marca como impresso no Firebase
          await marcarComoImpresso(pedido.id);
        }

        toast("Pedido marcado como PREPARANDO");
      } catch (erro) {
        console.error(erro);

        toast("Erro ao preparar pedido.");
      }
    });
  });

  document.querySelectorAll(".btn-pronto").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await alterarStatus(btn.dataset.id, "PRONTO");
        toast("Pedido marcado como PRONTO");
      } catch (erro) {
        console.error(erro);
        toast("Erro ao atualizar pedido.");
      }
    });
  });

  document.querySelectorAll(".btn-entregue").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await alterarStatus(btn.dataset.id, "ENTREGUE");
        toast("Pedido marcado como ENTREGUE");
      } catch (erro) {
        console.error(erro);
        toast("Erro ao atualizar pedido.");
      }
    });
  });

  document.querySelectorAll(".btn-cancelar").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await cancelarPedido(btn.dataset.id);
        toast("Pedido cancelado.");
      } catch (erro) {
        console.error(erro);
        toast("Erro ao cancelar pedido.");
      }
    });
  });
}

/* ==========================================
   NOVO PEDIDO
========================================== */

btnNovoPedido?.addEventListener("click", () => {
  abrirModal(
    "Novo Pedido",
    `
        <form id="formNovoPedido" class="form-grid">

            <div class="form-group">
                <label>Nome do cliente</label>
                <input type="text" id="cliente" required>
            </div>

            <div class="form-group">
                <label>Telefone</label>
                <input type="text" id="telefone">
            </div>

            <div class="form-group">
                <label>Tipo</label>
                <select id="tipoPedido">
                    <option value="Delivery">Delivery</option>
                    <option value="Retirada">Retirada</option>
                    <option value="Mesa">Mesa</option>
                </select>
            </div>

            <div class="form-group">
                <label>Observações</label>
                <textarea id="observacoes"></textarea>
            </div>

            <div class="modal-actions">
                <button
                    type="button"
                    class="btn btn-secondary"
                    id="cancelarPedido">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="btn btn-primary">
                    Salvar Pedido
                </button>
            </div>

        </form>
        `,
  );

  document
    .getElementById("cancelarPedido")
    ?.addEventListener("click", fecharModal);

  document
    .getElementById("formNovoPedido")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        await criarPedido({
          cliente: document.getElementById("cliente").value.trim(),
          telefone: document.getElementById("telefone").value.trim(),
          tipo: document.getElementById("tipoPedido").value,
          observacoes: document.getElementById("observacoes").value.trim(),
          itens: [],
          valorTotal: 0,
          pagamentoStatus: "PENDENTE",
        });

        toast("Pedido criado com sucesso!");
        fecharModal();
      } catch (erro) {
        console.error(erro);
        toast("Erro ao criar pedido.");
      }
    });
});

async function enviarParaImpressora(pedido) {
  console.log("========== PEDIDO FIREBASE REAL ==========");
  console.log(JSON.stringify(pedido, null, 2));
  console.log("==========================================");

  try {
    const res = await fetch("http://localhost:3002/print/order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pedido),
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    toast("Pedido enviado para impressora");
  } catch (erro) {
    console.error("Erro impressão:", erro);

    toast("Erro ao imprimir");
  }
}
