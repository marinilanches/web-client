import { abrirModal, fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

import {
    ouvirPedidos,
    criarPedido,
    alterarStatus,
    cancelarPedido
} from "../../js/services/orders.js";

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

    pedidos.forEach((pedido) => {
        const card = document.createElement("div");
        card.className = "panel";

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
                ${pedido.telefone || "-"}
            </p>

            <p>
                <strong>Tipo:</strong>
                ${pedido.tipo || "-"}
            </p>

            <p>
                <strong>Total:</strong>
                R$ ${Number(pedido.valorTotal || 0).toFixed(2)}
            </p>

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

function abrirDetalhesPedido(id){

    const pedido = pedidosCache.find(p => p.id === id);

    if(!pedido){
        toast("Pedido não encontrado");
        return;
    }


    const itensHTML = (pedido.itens || []).map(item => {

        const adicionais = (item.adicionais || [])
            .map(a => `${a.nome} (+R$ ${Number(a.preco || 0).toFixed(2)})`)
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
                    ?
                    `<p>
                        <strong>Adicionais:</strong><br>
                        ${adicionais}
                    </p>`
                    :
                    ""
                }


                ${
                    item.observacaoItem && item.observacaoItem.trim()
                    ?
                    `
                    <p>
                        <strong>📝 Observação:</strong><br>
                        ${item.observacaoItem}
                    </p>
                    `
                    :
                    ""
                }


                <hr>

            </div>
        `;

    }).join("");



    abrirModal(
        `Pedido #${pedido.numeroPedido}`,
        `

        <div>

            <h3>👤 Cliente</h3>

            <p>
                ${pedido.cliente}
            </p>

            <p>
                📞 ${pedido.telefone}
            </p>


            <h3>📦 Tipo</h3>

            <p>
                ${pedido.tipo}
            </p>

            ${
                pedido.tipo === "Delivery"
                ?
                `
                <h3>🚚 Entrega</h3>

                <p>
                    <strong>Bairro:</strong><br>
                    ${pedido.bairro || "-"}
                </p>

                <p>
                    <strong>Endereço:</strong><br>
                    ${pedido.endereco || "-"}
                </p>

                <p>
                    <strong>Referência:</strong><br>
                    ${pedido.referencia || "—"}
                </p>
                `
                :
                ""
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

                <button
                    type="button"
                    class="btn btn-primary"
                    id="btnImprimirComanda">

                    🖨️ Imprimir comanda

                </button>

            </div>

            ${
                pedido.observacoes
                ?
                `
                <h3>Observações</h3>
                <p>${pedido.observacoes}</p>
                `
                :
                ""
            }


        </div>

        `
    );

    document
        .getElementById("btnImprimirComanda")
        ?.addEventListener("click", () => {

            imprimirComanda(pedido);

        });

    }

function bindAcoesPedidos() {
    document.querySelectorAll(".btn-detalhes").forEach((btn)=>{

        btn.addEventListener("click", ()=>{

            abrirDetalhesPedido(btn.dataset.id);

        });

    });
    document.querySelectorAll(".btn-preparando").forEach((btn) => {
        btn.addEventListener("click", async () => {
            try {
                await alterarStatus(btn.dataset.id, "PREPARANDO");
                toast("Pedido marcado como PREPARANDO");
            } catch (erro) {
                console.error(erro);
                toast("Erro ao atualizar pedido.");
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
        `
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
                    pagamentoStatus: "PENDENTE"
                });

                toast("Pedido criado com sucesso!");
                fecharModal();

            } catch (erro) {
                console.error(erro);
                toast("Erro ao criar pedido.");
            }
        });
});

function imprimirComanda(pedido) {

    const itens = (pedido.itens || []).map(item => {

        const adicionais = (item.adicionais || [])
            .map(a =>
                `+ ${a.nome}   R$ ${Number(a.preco || 0).toFixed(2)}`
            )
            .join("<br>");

        return `
            <div style="margin-bottom:12px;">

                <strong>
                    ${item.quantidade}x ${item.nome}
                </strong>

                <br>

                R$ ${Number(item.valorUnitario || 0).toFixed(2)}

                ${
                    adicionais
                    ? `<div style="margin-left:10px;">${adicionais}</div>`
                    : ""
                }

                ${
                    item.observacaoItem
                    ? `
                        <div>
                            <strong>Obs:</strong><br>
                            ${item.observacaoItem}
                        </div>
                    `
                    : ""
                }

            </div>
        `;

    }).join("");

    const entrega = pedido.tipo === "Delivery"
        ? `
            <hr>

            <strong>ENTREGA</strong>

            <p>
                Bairro:<br>
                ${pedido.bairro || "-"}
            </p>

            <p>
                Endereço:<br>
                ${pedido.endereco || "-"}
            </p>

            <p>
                Referência:<br>
                ${pedido.referencia || "-"}
            </p>
        `
        : "";

    const janela = window.open("", "_blank", "width=420,height=700");

    janela.document.write(`
<!DOCTYPE html>

<html>

<head>

<meta charset="utf-8">

<title>Comanda</title>

<style>

body{

    width:80mm;

    margin:0 auto;

    padding:8px;

    font-family:monospace;

    font-size:12px;

}

h2,h3{

    text-align:center;

    margin:5px 0;

}

hr{

    border:none;

    border-top:1px dashed #000;

    margin:8px 0;

}

.total{

    font-size:16px;

    font-weight:bold;

}

</style>

</head>

<body>

<h2>MESA FÁCIL</h2>

<hr>

Pedido #${pedido.numeroPedido}

<br>

${new Date().toLocaleString("pt-BR")}

<hr>

<strong>Cliente</strong><br>

${pedido.cliente}

<br><br>

<strong>Telefone</strong><br>

${pedido.telefone}

<br><br>

<strong>Tipo</strong><br>

${pedido.tipo}

<hr>

${itens}

${entrega}

<hr>

Pagamento:<br>

${pedido.pagamentoMetodo}

<hr>

Subtotal:
R$ ${Number(pedido.valorSubtotal || 0).toFixed(2)}

<br>

Entrega:
R$ ${Number(pedido.taxaEntrega || 0).toFixed(2)}

<hr>

<div class="total">

TOTAL

<br>

R$ ${Number(pedido.valorTotal || 0).toFixed(2)}

</div>

<hr>

<center>

Obrigado pela preferência!

</center>

<script>

window.onload = () => {

    window.print();

    window.onafterprint = () => window.close();

};

</script>

</body>

</html>
`);

    janela.document.close();

}