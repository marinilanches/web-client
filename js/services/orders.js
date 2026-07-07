import { db } from "./firebase.js";

import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ==========================================================
   MESA FÁCIL
   ORDERS SERVICE
========================================================== */

const pedidosRef = collection(db, "pedidos");

/* ==========================================================
   CRIAR PEDIDO
========================================================== */

export async function criarPedido(dados) {

    try {

        const pedido = {

            numeroPedido: dados.numeroPedido || null,

            cliente: dados.cliente || "",

            telefone: dados.telefone || "",

            tipo: dados.tipo || "Delivery",

            clienteId: dados.clienteId || null,

            mesaId: dados.mesaId || null,

            itens: dados.itens || [],

            observacoes: dados.observacoes || "",

            valorTotal: Number(dados.valorTotal || 0),

            pagamentoMetodo: dados.pagamentoMetodo || "",

            pagamentoStatus: dados.pagamentoStatus || "PENDENTE",

            status: "RECEBIDO",

            createdAt: serverTimestamp(),

            updatedAt: serverTimestamp()

        };

        return await addDoc(pedidosRef, pedido);

    } catch (erro) {

        console.error("Erro ao criar pedido:", erro);

        throw erro;

    }

}

/* ==========================================================
   EDITAR PEDIDO
========================================================== */

export async function editarPedido(id, dados) {

    try {

        await updateDoc(

            doc(db, "pedidos", id),

            {
                ...dados,
                updatedAt: serverTimestamp()
            }

        );

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

        await updateDoc(

            doc(db, "pedidos", id),

            {
                status,
                updatedAt: serverTimestamp()
            }

        );

    } catch (erro) {

        console.error("Erro ao alterar status:", erro);

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

        await deleteDoc(
            doc(db, "pedidos", id)
        );

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

        const pedido = await getDoc(
            doc(db, "pedidos", id)
        );

        if (!pedido.exists()) {
            return null;
        }

        return {
            id: pedido.id,
            ...pedido.data()
        };

    } catch (erro) {

        console.error("Erro ao buscar pedido:", erro);

        throw erro;

    }

}

/* ==========================================================
   OUVIR PEDIDOS (TEMPO REAL)
========================================================== */

export function ouvirPedidos(callback) {

    const q = query(
        pedidosRef,
        orderBy("createdAt", "desc")
    );

    return onSnapshot(

        q,

        (snapshot) => {

            const pedidos = [];

            snapshot.forEach((docItem) => {

                pedidos.push({
                    id: docItem.id,
                    ...docItem.data()
                });

            });

            callback(pedidos);

        },

        (erro) => {

            console.error("Erro ao ouvir pedidos:", erro);

        }

    );

}

/* ==========================================================
   CONTADORES
========================================================== */

export function contarPedidos(pedidos) {

    return {

        total: pedidos.length,

        recebidos: pedidos.filter(p => p.status === "RECEBIDO").length,

        preparando: pedidos.filter(p => p.status === "PREPARANDO").length,

        prontos: pedidos.filter(p => p.status === "PRONTO").length,

        entregues: pedidos.filter(p => p.status === "ENTREGUE").length,

        cancelados: pedidos.filter(p => p.status === "CANCELADO").length,

        faturamento: pedidos
            .filter(p => p.status === "ENTREGUE")
            .reduce((total, pedido) => {
                return total + Number(pedido.valorTotal || 0);
            }, 0)

    };

}