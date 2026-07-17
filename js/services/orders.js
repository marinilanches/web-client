import { db } from "./firebase.js";
import { incrementarVendasProdutos } from "./products.js";

import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ==========================================================
   MESA FÁCIL
   ORDERS SERVICE
========================================================== */

const pedidosRef = collection(db, "pedidos");

function getInicioEFimDeHoje() {
  const agora = new Date();

  const inicioHoje = new Date(agora);
  inicioHoje.setHours(0, 0, 0, 0);

  const inicioAmanha = new Date(inicioHoje);
  inicioAmanha.setDate(inicioAmanha.getDate() + 1);

  return {
    inicioHoje: Timestamp.fromDate(inicioHoje),
    inicioAmanha: Timestamp.fromDate(inicioAmanha),
  };
}

/* ==========================================================
   HELPERS
========================================================== */

function somenteNumeros(valor = "") {
  return String(valor).replace(/\D/g, "");
}

function normalizarTelefoneWhatsapp(telefone) {
  let numero = somenteNumeros(telefone);

  if (!numero) return "";

  // remove zeros à esquerda
  numero = numero.replace(/^0+/, "");

  // se vier sem DDI e com 8/9 dígitos -> assume Capivari/SP (19)
  if (numero.length === 8 || numero.length === 9) {
    numero = `19${numero}`;
  }

  // se vier com DDD + número (10 ou 11 dígitos) -> adiciona 55
  if (numero.length === 10 || numero.length === 11) {
    numero = `55${numero}`;
  }

  // se vier com 13 dígitos e já começar com 55, mantém
  if (numero.length === 12 && numero.startsWith("55")) {
    return numero;
  }

  if (numero.length === 13 && numero.startsWith("55")) {
    return numero;
  }

  // se vier com 12/13 sem 55 mas já parecer Brasil, força 55
  if (
    (numero.length === 12 || numero.length === 13) &&
    !numero.startsWith("55")
  ) {
    numero = `55${numero}`;
  }

  return numero;
}

function extrairBairro(endereco = "") {
  if (!endereco) return "";

  // Novo formato:
  // {
  //   rua:"",
  //   numero:"",
  //   bairro:"",
  //   complemento:""
  // }
  if (typeof endereco === "object") {
    return endereco.bairro || "";
  }

  // Formato antigo:
  // "Rua X, 123, Centro"
  if (typeof endereco === "string") {
    const partes = endereco
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (partes.length >= 3) return partes[2];

    if (partes.length >= 2) return partes[partes.length - 1];
  }

  return "";
}

/* ==========================================================
   CRIAR PEDIDO
========================================================== */

async function atualizarEstatisticasCliente(dados) {
  if (!dados.clienteId) return;

  const clienteRef = doc(db, "clientes", dados.clienteId);

  await updateDoc(clienteRef, {
    totalPedidos: increment(1),

    totalGasto: increment(Number(dados.valorTotal || 0)),

    ultimaCompra: serverTimestamp(),

    atualizadoEm: serverTimestamp(),
  });
}

export async function criarPedido(dados) {
  const agora = serverTimestamp();

  const telefone = dados.telefone || "";
  const telefoneWhatsapp =
    dados.telefoneWhatsapp || normalizarTelefoneWhatsapp(telefone);

  const valorSubtotal = Number(dados.valorSubtotal ?? dados.valorTotal ?? 0);
  const taxaEntrega = Number(dados.taxaEntrega ?? 0);
  const valorTotal = Number(dados.valorTotal ?? valorSubtotal + taxaEntrega);

  const itens = Array.isArray(dados.itens) ? dados.itens : [];

  const payload = {
    numeroPedido: dados.numeroPedido || Math.floor(1000 + Math.random() * 9000),

    origem: dados.origem || "CLIENTE_WEB",

    cliente: dados.cliente || "",
    clienteId: dados.clienteId || null,

    telefone,
    telefoneWhatsapp,

    tipo: dados.tipo || "Delivery",
    status: dados.status || "RECEBIDO",

    endereco: dados.endereco || {
      rua: "",
      numero: "",
      bairro: "",
      complemento: "",
    },
    referencia: dados.referencia || "",
    observacoes: dados.observacoes || "",

    bairro: dados.bairro || extrairBairro(dados.endereco || ""),
    bairroId: dados.bairroId || null,
    bairroLabel: dados.bairroLabel || "",

    latitude: dados.latitude ?? null,
    longitude: dados.longitude ?? null,

    itens,

    pagamentoMetodo: dados.pagamentoMetodo || "",
    pagamentoStatus: dados.pagamentoStatus || "PENDENTE",
    trocoPara: dados.trocoPara ?? null,

    valorSubtotal,
    taxaEntrega,
    valorTotal,

    mesaId: dados.mesaId || null,
    ultimoStatusNotificado: dados.ultimoStatusNotificado || null,

    impresso: Boolean(dados.impresso),
    impressoEm: dados.impressoEm || null,

    criadoEm: agora,
    atualizadoEm: agora,
  };

  const pedidoRef = await addDoc(pedidosRef, payload);

  await incrementarVendasProdutos(itens);

  try {
    await atualizarEstatisticasCliente(payload);
  } catch (erro) {
    console.error("Erro ao atualizar estatísticas do cliente:", erro);
  }

  return pedidoRef;
}

/* ==========================================================
   EDITAR PEDIDO
========================================================== */

export async function editarPedido(id, dados) {
  try {
    const updatePayload = {
      ...dados,
      atualizadoEm: serverTimestamp(),
    };

    if ("telefone" in dados && !("telefoneWhatsapp" in dados)) {
      updatePayload.telefoneWhatsapp = normalizarTelefoneWhatsapp(
        dados.telefone,
      );
    }

    await updateDoc(doc(db, "pedidos", id), updatePayload);
  } catch (erro) {
    console.error("Erro ao editar pedido:", erro);
    throw erro;
  }
}

/* ==========================================================
   ALTERAR STATUS
========================================================== */

export async function alterarStatus(id, status) {
  try {
    await updateDoc(doc(db, "pedidos", id), {
      status,
      atualizadoEm: serverTimestamp(),
    });
  } catch (erro) {
    console.error("Erro ao alterar status:", erro);
    throw erro;
  }
}

/* ==========================================================
   ATUALIZAR ENTREGADOR DO PEDIDO
========================================================== */

export async function atualizarEntregadorPedido(id, entrega) {

  try {

    await updateDoc(

      doc(db, "pedidos", id),

      {

        entrega,

        atualizadoEm:
        serverTimestamp()

      }

    );

  } catch (erro) {

    console.error(
      "Erro ao atualizar entrega:",
      erro
    );

    throw erro;

  }

}

/* ==========================================================
   CANCELAR PEDIDO
========================================================== */

export async function cancelarPedido(id) {
  return alterarStatus(id, "CANCELADO");
}

/* ==========================================================
   EXCLUIR PEDIDO
========================================================== */

export async function excluirPedido(id) {
  try {
    await deleteDoc(doc(db, "pedidos", id));
  } catch (erro) {
    console.error("Erro ao excluir pedido:", erro);
    throw erro;
  }
}

/* ==========================================================
   BUSCAR PEDIDO
========================================================== */

export async function buscarPedido(id) {
  try {
    const pedidoSnap = await getDoc(doc(db, "pedidos", id));

    if (!pedidoSnap.exists()) {
      return null;
    }

    return {
      id: pedidoSnap.id,
      ...pedidoSnap.data(),
    };
  } catch (erro) {
    console.error("Erro ao buscar pedido:", erro);
    throw erro;
  }
}

export async function marcarComoImpresso(id) {
  try {
    await updateDoc(doc(db, "pedidos", id), {
      impresso: true,
      impressoEm: serverTimestamp(),
    });
  } catch (erro) {
    console.error("Erro ao marcar impressão:", erro);

    throw erro;
  }
}

/* ==========================================================
   OUVIR PEDIDOS (LISTA EM TEMPO REAL)
========================================================== */

export function ouvirPedidos(callback) {
  const { inicioHoje, inicioAmanha } = getInicioEFimDeHoje();

  const q = query(
    pedidosRef,
    where("criadoEm", ">=", inicioHoje),
    where("criadoEm", "<", inicioAmanha),
    orderBy("criadoEm", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const pedidos = [];

      snapshot.forEach((docItem) => {
        pedidos.push({
          id: docItem.id,
          ...docItem.data(),
        });
      });

      callback(pedidos);
    },
    (erro) => {
      console.error("Erro ao ouvir pedidos:", erro);
    },
  );
}

/* ==========================================================
   OUVIR UM PEDIDO ESPECÍFICO (TEMPO REAL)
========================================================== */

export function ouvirPedidoPorId(pedidoId, onSuccess, onNotFound) {
  const ref = doc(db, "pedidos", pedidoId);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onNotFound?.();
        return;
      }

      onSuccess({
        id: snap.id,
        ...snap.data(),
      });
    },
    (erro) => {
      console.error("Erro ao ouvir pedido por ID:", erro);
    },
  );
}

/* ==========================================================
   CONTADORES
========================================================== */

export function contarPedidos(pedidos) {
  return {
    total: pedidos.length,
    recebidos: pedidos.filter((p) => p.status === "RECEBIDO").length,
    preparando: pedidos.filter((p) => p.status === "PREPARANDO").length,
    prontos: pedidos.filter((p) => p.status === "PRONTO").length,
    entregues: pedidos.filter((p) => p.status === "ENTREGUE").length,
    cancelados: pedidos.filter((p) => p.status === "CANCELADO").length,
    faturamento: pedidos
      .filter((p) => p.status === "ENTREGUE")
      .reduce((total, pedido) => total + Number(pedido.valorTotal || 0), 0),
  };
}

/* ==========================================================
   OUVIR PEDIDOS DO CLIENTE
========================================================== */

export function ouvirPedidosCliente(uid, callback) {
  const { inicioHoje, inicioAmanha } = getInicioEFimDeHoje();

  const q = query(
    pedidosRef,
    where("clienteId", "==", uid),
    where("criadoEm", ">=", inicioHoje),
    where("criadoEm", "<", inicioAmanha),
    orderBy("criadoEm", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const pedidos = [];

      snapshot.forEach((docItem) => {
        pedidos.push({
          id: docItem.id,
          ...docItem.data(),
        });
      });

      callback(pedidos);
    },
    (erro) => {
      console.error("Erro ao ouvir pedidos do cliente:", erro);
    },
  );
}
