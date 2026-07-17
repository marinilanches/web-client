// admin/js/pdv/pedido.js

import { getClienteSelecionado, getClienteId } from "./cliente.js";

import { getMesaSelecionada, getMesaId } from "./mesa.js";

import {
  getEnderecoEntrega,
  getTaxaEntrega,
  validarEntrega,
} from "./delivery.js";

import { getTipoPedido, isDelivery, isMesa } from "./tipoPedido.js";

import { obterCarrinho, totalCarrinho } from "./carrinho.js";

import {
  getDesconto,
  calcularTotalComDesconto,
  validarDesconto,
} from "./desconto.js";

import { getPagamento, validarPagamento } from "./pagamento.js";

import { toast } from "../../components/toast.js";

/* ==========================================================
   ESTADO
========================================================== */

let pedidoAtual = null;

/* ==========================================================
   MONTAR PEDIDO
========================================================== */

export function montarPedido() {
  const carrinho = obterCarrinho();

  const valorSubtotal = totalCarrinho();

  const taxaEntrega = getTaxaEntrega();

  const valorTotal = calcularTotalComDesconto(valorSubtotal + taxaEntrega);

  const cliente = getClienteSelecionado();

  const pedido = {
    clienteId: getClienteId(),

    cliente: cliente?.nome || "",

    telefone: cliente?.telefone || "",

    telefoneWhatsapp:
      cliente?.telefoneWhatsapp ||
      (cliente?.telefone ? cliente.telefone.replace(/\D/g, "") : ""),

    mesaId: getMesaId(),

    tipo: getTipoPedido(),

    endereco: getEnderecoFormatado(),

    bairro: getEnderecoEntrega().bairro || "",

    itens: carrinho,

    valorSubtotal,

    taxaEntrega,

    valorTotal,

    pagamentoMetodo: getPagamento().forma || "",

    trocoPara:
      getPagamento().forma === "dinheiro" ? getPagamento().valorRecebido : null,

    status: "RECEBIDO",

    origem: "PDV",
  };

  pedidoAtual = pedido;

  return pedido;
}

/* ==========================================================
   VALIDAÇÃO
========================================================== */

export function validarPedido() {
  const carrinho = obterCarrinho();

  if (!carrinho.length) {
    toast("Adicione produtos ao pedido.");

    return false;
  }

  if (isDelivery() && !validarEntrega()) {
    return false;
  }

  if (isMesa() && !getMesaId()) {
    toast("Selecione uma mesa.");

    return false;
  }

  if (!validarDesconto()) {
    return false;
  }

  const valorTotal = calcularTotalComDesconto(totalCarrinho());

  if (!validarPagamento(valorTotal)) {
    return false;
  }

  return true;
}

/* ==========================================================
   CLIENTE
========================================================== */

function obterDadosCliente() {
  const cliente = getClienteSelecionado();

  if (!cliente) {
    return null;
  }

  return {
    id: cliente.id,

    nome: cliente.nome,

    telefone: cliente.telefone || "",
  };
}

/* ==========================================================
   ENTREGA
========================================================== */

function getEnderecoFormatado() {
  const endereco = getEnderecoEntrega();

  if (!endereco) {
    return "";
  }

  return [endereco.rua, endereco.numero, endereco.bairro]
    .filter(Boolean)
    .join(", ");
}

/* ==========================================================
   GETTERS
========================================================== */

export function getPedidoAtual() {
  return pedidoAtual;
}

export function possuiPedidoAtual() {
  return pedidoAtual !== null;
}

/* ==========================================================
   RESET
========================================================== */

export function limparPedido() {
  pedidoAtual = null;
}

/* ==========================================================
   RECRIAR PEDIDO
========================================================== */

export function atualizarPedido() {
  pedidoAtual = montarPedido();

  return pedidoAtual;
}
