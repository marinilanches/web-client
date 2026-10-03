import { abrirModal, fecharModal } from "./modal.js";

import { toast } from "./toast.js";

import {
  atualizarEntregadorPedido,
  alterarStatus,
  cancelarPedido,
  excluirPedido,
  marcarComoImpresso,
  ouvirSolicitacoesPedido,
  responderSolicitacaoAdmin,
} from "../../js/services/orders.js";

import { solicitarEntregador } from "../../js/services/bee-delivery.js";

import { marcarSolicitacoesComoAbertas } from "../js/notificadorPedidos.js";

let unsubscribeSolicitacoes = null;

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatarHorarioSolicitacao(valor) {
  if (!valor) return "—";

  const data =
    typeof valor.toDate === "function" ? valor.toDate() : new Date(valor);

  if (Number.isNaN(data.getTime())) return "—";

  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function renderSolicitacoesAdmin(pedido, solicitacoes) {
  const container = document.getElementById("solicitacoesPedidoAdmin");
  if (!container) return;

  if (!solicitacoes.length) {
    container.innerHTML = `
      <h3>💬 Solicitações do cliente</h3>
      <p class="text-secondary">Nenhuma solicitação pendente.</p>
    `;
    return;
  }

  container.innerHTML = `
    <h3>💬 Solicitações do cliente</h3>
    ${solicitacoes
      .map((solicitacao) => {
        const ehCancelamento = solicitacao.tipo === "CANCELAMENTO";
        const ehProposta =
          solicitacao.tipo === "PREVISAO_ENTREGA" ||
          solicitacao.tipo === "ATRASO";

        const titulo = ehCancelamento
          ? "❌ Solicitação de cancelamento"
          : solicitacao.tipo === "ATRASO"
            ? "⚠️ Pedido atrasado"
            : "🕐 Nova previsão de entrega";

        let acoes = "";

        if (solicitacao.status === "PENDENTE" && ehProposta) {
          acoes = `
            <div class="border rounded p-3 mt-3">
              <label class="form-label"><strong>Quanto tempo a mais você precisa?</strong></label>
              <div class="input-group mb-3">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  class="form-control"
                  id="tempo-${solicitacao.id}"
                  value="10"
                >
                <span class="input-group-text">minutos</span>
              </div>

              <label class="form-label"><strong>Motivo</strong></label>
              <textarea
                class="form-control mb-3"
                id="motivo-${solicitacao.id}"
                rows="2"
                placeholder="Poderia nos informar o motivo para o novo tempo?"
              ></textarea>

              <button
                class="btn btn-primary w-100"
                type="button"
                data-propor-previsao="${solicitacao.id}"
              >
                📤 Enviar nova previsão
              </button>
            </div>
          `;
        } else if (solicitacao.status === "PENDENTE" && ehCancelamento) {
          acoes = `
            <div class="d-flex gap-2 mt-3">
              <button class="btn btn-danger flex-fill" type="button" data-aceitar-cancelamento="${solicitacao.id}">
                ✅ Aceitar cancelamento
              </button>
              <button class="btn btn-outline-secondary flex-fill" type="button" data-recusar-cancelamento="${solicitacao.id}">
                ❌ Recusar
              </button>
            </div>
          `;
        } else if (solicitacao.status === "AGUARDANDO_CLIENTE") {
          acoes = `
            <div class="alert alert-info mt-3 mb-0">
              Aguardando resposta do cliente até <strong>${formatarHorarioSolicitacao(solicitacao.aceitaAte)}</strong>.
              <br>
              Nova previsão: <strong>${formatarHorarioSolicitacao(solicitacao.horarioProposto)}</strong>.
            </div>
          `;
        } else if (
          solicitacao.status === "ACEITA" ||
          solicitacao.status === "ACEITA_TIMEOUT"
        ) {
          acoes = `<div class="alert alert-success mt-3 mb-0">✅ Solicitação aceita${solicitacao.status === "ACEITA_TIMEOUT" ? " automaticamente após 5 minutos" : " pelo cliente"}.</div>`;
        } else if (solicitacao.status === "RECUSADA") {
          acoes = `<div class="alert alert-secondary mt-3 mb-0">❌ Solicitação recusada.</div>`;
        }

        return `
          <div class="border rounded p-3 mb-3">
            <strong>${titulo}</strong>
            <p class="mt-2 mb-1">${escaparHtml(solicitacao.mensagem || "")}</p>
            <small class="text-secondary">Status: ${escaparHtml(solicitacao.status || "—")}</small>
            ${solicitacao.motivo ? `<p class="mt-2 mb-0"><strong>Motivo:</strong> ${escaparHtml(solicitacao.motivo)}</p>` : ""}
            ${acoes}
          </div>
        `;
      })
      .join("")}
  `;

  container.querySelectorAll("[data-propor-previsao]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.dataset.proporPrevisao;
      const minutos = Number(
        document.getElementById(`tempo-${id}`)?.value || 0,
      );
      const motivo =
        document.getElementById(`motivo-${id}`)?.value?.trim() || "";

      if (!Number.isFinite(minutos) || minutos <= 0) {
        toast("Informe um tempo adicional válido.");
        return;
      }

      try {
        await responderSolicitacaoAdmin(pedido.id, id, {
          status: "AGUARDANDO_CLIENTE",
          tempoAdicionalMinutos: minutos,
          motivo,
        });
        toast("Nova previsão enviada ao cliente.");
      } catch (erro) {
        console.error(erro);
        toast("Erro ao enviar nova previsão.");
      }
    });
  });

  container.querySelectorAll("[data-aceitar-cancelamento]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      try {
        await responderSolicitacaoAdmin(
          pedido.id,
          botao.dataset.aceitarCancelamento,
          {
            status: "ACEITA",
          },
        );
        toast("Cancelamento aceito.");
      } catch (erro) {
        console.error(erro);
        toast("Erro ao aceitar cancelamento.");
      }
    });
  });

  container.querySelectorAll("[data-recusar-cancelamento]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      try {
        await responderSolicitacaoAdmin(
          pedido.id,
          botao.dataset.recusarCancelamento,
          {
            status: "RECUSADA",
          },
        );
        toast("Cancelamento recusado.");
      } catch (erro) {
        console.error(erro);
        toast("Erro ao recusar cancelamento.");
      }
    });
  });
}

export function abrirDetalhesPedido(pedido) {
  if (!pedido) {
    toast("Pedido não encontrado");

    return;
  }

  const itensHTML = (pedido.itens || [])

    .map((item) => {
      const adicionais = (item.adicionais || [])

        .map(
          (adicional) =>
            `${adicional.nome} (+R$ ${Number(adicional.preco || 0).toFixed(
              2,
            )})`,
        )

        .join("<br>");

      return `

      <div class="item-pedido">


        <strong>

          ${item.nome || "-"}

        </strong>



        <p>

          Quantidade:

          ${item.quantidade || 1}

        </p>




        <p>

          Valor unitário:

          R$

          ${Number(item.valorUnitario || 0).toFixed(2)}

        </p>




        ${
          adicionais
            ? `

          <p>

            <strong>

              Adicionais:

            </strong>

            <br>

            ${adicionais}

          </p>

          `
            : ""
        }






        ${
          item.observacaoItem
            ? `

          <p>

            <strong>

              📝 Observação:

            </strong>

            <br>

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
    `Pedido #${pedido.numeroPedido || "-"}`,

    `

    <div>



      <h3>

        👤 Cliente

      </h3>



      <p>

        ${pedido.cliente || "-"}

      </p>




      <p>

        📞

        ${pedido.telefone || pedido.telefoneWhatsapp || "-"}

      </p>






      <h3>

        📦 Tipo

      </h3>



      <p>

        ${pedido.tipo || "-"}

      </p>






      ${
        pedido.tipo === "Delivery"
          ? `

        <h3>

          🚚 Entrega

        </h3>





        ${
          pedido.entrega
            ? `

          <h3>

            🚚 Bee Delivery

          </h3>




          <p>

            <strong>

            Status:

            </strong>

            <br>

            ${pedido.entrega.statusDescricao || pedido.entrega.status || "-"}


          </p>




          <p>

            <strong>

            Código:

            </strong>

            <br>

            ${pedido.entrega.id || "-"}


          </p>




          <p>

            <strong>

            Previsão:

            </strong>

            <br>


            ${
              pedido.entrega.previsaoMinutos
                ? `${pedido.entrega.previsaoMinutos} min`
                : "-"
            }


          </p>





          <p>

            <strong>

            Entregador:

            </strong>

            <br>


            ${pedido.entrega.entregador?.nome || "-"}


          </p>




          <p>

            <strong>

            Telefone:

            </strong>

            <br>


            ${pedido.entrega.entregador?.telefone || "-"}


          </p>





          ${
            pedido.entrega.trackingUrl
              ? `

            <p>

              <a

              href="${pedido.entrega.trackingUrl}"

              target="_blank"

              >

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

          <strong>

          Bairro:

          </strong>

          <br>


          ${pedido.bairro || "-"}


        </p>

        ${
          pedido.distanciaEntrega != null
            ? `
            <p>
              <strong>
              Distância:
              </strong>

              <br>

              ${Number(pedido.distanciaEntrega).toFixed(2)} km

            </p>
          `
            : ""
        }


        <p>

          <strong>

          Taxa de entrega:

          </strong>

          <br>

          R$ ${Number(pedido.taxaEntrega || 0).toFixed(2)}

        </p>



        <p>

          <strong>

          CEP:

          </strong>

          <br>


          ${pedido.endereco?.cep || "-"}


        </p>






        <p>

          <strong>

          Endereço:

          </strong>

          <br>


          ${pedido.endereco?.rua || "-"}


          ${pedido.endereco?.numero ? `, ${pedido.endereco.numero}` : ""}


        </p>






        <p>

          <strong>

          Referência:

          </strong>

          <br>


          ${pedido.endereco?.complemento || pedido.referencia || "—"}


        </p>


        `
          : ""
      }







      <h3>

        🍔 Itens

      </h3>




      ${itensHTML || "Nenhum item"}







      <h3>

        💰 Pagamento

      </h3>




      <p>

        Método:

        ${pedido.pagamentoMetodo || "-"}


      </p>




      <p>

        Status:

        ${pedido.pagamentoStatus || "-"}


      </p>







      ${
        pedido.pagamentoMetodo === "DINHEIRO"
          ? `

        <p>

          <strong>

          Cliente paga:

          </strong>

          <br>

          R$

          ${Number(pedido.trocoPara || 0).toFixed(2)}


        </p>



        <p>

          <strong>

          Troco:

          </strong>

          <br>


          R$

          ${(
            Number(pedido.trocoPara || 0) - Number(pedido.valorTotal || 0)
          ).toFixed(2)}


        </p>


        `
          : ""
      }







      <h3>

        Total

      </h3>



      <h2>

        R$

        ${Number(pedido.valorTotal || 0).toFixed(2)}


      </h2>






      ${
        pedido.observacoes
          ? `

        <h3>

          Observações

        </h3>


        <p>

          ${pedido.observacoes}

        </p>

        `
          : ""
      }






      <div id="solicitacoesPedidoAdmin" class="mb-4"></div>

      <div class="modal-actions">

        ${
          pedido.status === "RECEBIDO"
            ? `
                <button
                    class="btn btn-primary"
                    id="btnPreparando">
                    👨‍🍳 Iniciar preparo
                </button>
            `
            : ""
        }

        ${
          pedido.status === "PREPARANDO"
            ? `
                <button
                    class="btn btn-primary"
                    id="btnPronto">
                    ✅ Pedido pronto
                </button>
            `
            : ""
        }

        ${
          pedido.status === "PRONTO"
            ? `
                <button
                  class="btn btn-primary"
                  id="btnSairParaEntrega">
                  🚚 Sair para entrega
                </button>
            `
            : ""
        }

        ${
          pedido.tipo === "Delivery" && !pedido.entrega
            ? `
                <button
                    class="btn btn-secondary"
                    id="btnSolicitarEntregador">
                    🚚 Solicitar entregador
                </button>
            `
            : ""
        }

        <button
          class="btn btn-secondary"
          id="btnImprimirComanda">
          🖨️ Imprimir comanda
        </button>

        ${
          pedido.status !== "CANCELADO"
            ? `
                <button
                    class="btn btn-danger"
                    id="btnCancelarPedido">
                    ❌ Cancelar pedido
                </button>
            `
            : ""
        }

        <button
          class="btn btn-danger"
          id="btnExcluirPedido">
          🗑️ Excluir pedido
        </button>

      </div>




    </div>

    `,
  );

  unsubscribeSolicitacoes?.();

  let primeiraLeituraSolicitacoes = true;

  unsubscribeSolicitacoes = ouvirSolicitacoesPedido(
    pedido.id,
    (solicitacoes) => {
      if (primeiraLeituraSolicitacoes) {
        const solicitacoesPendentes = solicitacoes.filter(
          (solicitacao) => solicitacao.status === "PENDENTE",
        );

        marcarSolicitacoesComoAbertas(
          solicitacoesPendentes.map((solicitacao) => solicitacao.id),
        );

        primeiraLeituraSolicitacoes = false;
      }

      renderSolicitacoesAdmin(pedido, solicitacoes);
    },
  );

  document

    .getElementById("btnImprimirComanda")

    ?.addEventListener(
      "click",

      () => {
        enviarParaImpressora(pedido);
      },
    );

  document
    .getElementById("btnPreparando")
    ?.addEventListener("click", async () => {
      try {
        await alterarStatus(pedido.id, "PREPARANDO");

        if (!pedido.impresso) {
          await enviarParaImpressora(pedido);

          await marcarComoImpresso(pedido.id);
        }

        toast("Pedido marcado como PREPARANDO");

        fecharModal();
      } catch (erro) {
        console.error(erro);

        toast("Erro ao preparar pedido.");
      }
    });

  document.getElementById("btnPronto")?.addEventListener("click", async () => {
    try {
      await alterarStatus(pedido.id, "PRONTO");

      toast("Pedido marcado como PRONTO");

      fecharModal();
    } catch (erro) {
      console.error(erro);

      toast("Erro ao atualizar pedido.");
    }
  });

  document
    .getElementById("btnSairParaEntrega")
    ?.addEventListener("click", async () => {
      try {
        await alterarStatus(pedido.id, "SAIU_PARA_ENTREGA");

        toast("Pedido saiu para entrega");

        fecharModal();
      } catch (erro) {
        console.error(erro);

        toast("Erro ao atualizar pedido.");
      }
    });

  document
    .getElementById("btnCancelarPedido")
    ?.addEventListener("click", async () => {
      try {
        await cancelarPedido(pedido.id);

        toast("Pedido cancelado.");

        fecharModal();
      } catch (erro) {
        console.error(erro);

        toast("Erro ao cancelar pedido.");
      }
    });

  document
    .getElementById("btnExcluirPedido")
    ?.addEventListener("click", async () => {
      const confirmar = confirm("Deseja realmente excluir este pedido?");

      if (!confirmar) return;

      try {
        await excluirPedido(pedido.id);

        toast("Pedido excluído com sucesso.");

        fecharModal();
      } catch (erro) {
        console.error(erro);

        toast("Erro ao excluir pedido.");
      }
    });

  document

    .getElementById("btnSolicitarEntregador")

    ?.addEventListener(
      "click",

      async () => {
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
        } catch (erro) {
          console.error(erro);

          toast("Erro ao solicitar entregador.");
        }
      },
    );
}

async function enviarParaImpressora(pedido) {
  try {
    const resposta = await fetch("http://localhost:3002/print/order", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(pedido),
    });

    const data = await resposta.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    toast("Pedido enviado para impressora");
  } catch (erro) {
    console.error("Erro impressão:", erro);

    toast("Erro ao imprimir");
  }
}
