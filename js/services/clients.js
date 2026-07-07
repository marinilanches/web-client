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
   CLIENTS SERVICE
========================================================== */

const clientesRef = collection(db, "clientes");

/* ==========================================================
   CRIAR CLIENTE
========================================================== */

export async function criarCliente(dados) {

    try {

        const cliente = {
            nome: dados.nome || "",
            telefone: dados.telefone || "",
            email: dados.email || "",
            observacoes: dados.observacoes || "",
            totalPedidos: Number(dados.totalPedidos || 0),
            totalGasto: Number(dados.totalGasto || 0),

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        return await addDoc(clientesRef, cliente);

    } catch (erro) {

        console.error("Erro ao criar cliente:", erro);
        throw erro;

    }

}

/* ==========================================================
   EDITAR CLIENTE
========================================================== */

export async function editarCliente(id, dados) {

    try {

        await updateDoc(
            doc(db, "clientes", id),
            {
                ...dados,
                updatedAt: serverTimestamp()
            }
        );

    } catch (erro) {

        console.error("Erro ao editar cliente:", erro);
        throw erro;

    }

}

/* ==========================================================
   EXCLUIR CLIENTE
========================================================== */

export async function excluirCliente(id) {

    try {

        await deleteDoc(
            doc(db, "clientes", id)
        );

    } catch (erro) {

        console.error("Erro ao excluir cliente:", erro);
        throw erro;

    }

}

/* ==========================================================
   BUSCAR CLIENTE
========================================================== */

export async function buscarCliente(id) {

    try {

        const cliente = await getDoc(
            doc(db, "clientes", id)
        );

        if (!cliente.exists()) {
            return null;
        }

        return {
            id: cliente.id,
            ...cliente.data()
        };

    } catch (erro) {

        console.error("Erro ao buscar cliente:", erro);
        throw erro;

    }

}

/* ==========================================================
   OUVIR CLIENTES (TEMPO REAL)
========================================================== */

export function ouvirClientes(callback) {

    const q = query(
        clientesRef,
        orderBy("createdAt", "desc")
    );

    return onSnapshot(

        q,

        (snapshot) => {

            const clientes = [];

            snapshot.forEach((docItem) => {
                clientes.push({
                    id: docItem.id,
                    ...docItem.data()
                });
            });

            callback(clientes);

        },

        (erro) => {
            console.error("Erro ao ouvir clientes:", erro);
        }

    );

}