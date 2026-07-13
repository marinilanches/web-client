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
   TABLES SERVICE
========================================================== */

const mesasRef = collection(db, "mesas");

/* ==========================================================
   CRIAR MESA
========================================================== */

export async function criarMesa(dados) {

    try {

        const mesa = {

            numero: Number(dados.numero || 0),
            capacidade: Number(dados.capacidade || 4),
            status: dados.status || "LIVRE",
            pessoas: Number(dados.pessoas || 0),
            observacoes: dados.observacoes || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()

        };

        return await addDoc(mesasRef, mesa);

    } catch (erro) {

        console.error("Erro ao criar mesa:", erro);
        throw erro;

    }

}

/* ==========================================================
   EDITAR MESA
========================================================== */

export async function editarMesa(id, dados) {

    try {

        await updateDoc(
            doc(db, "mesas", id),
            {
                ...dados,
                updatedAt: serverTimestamp()
            }
        );

    } catch (erro) {

        console.error("Erro ao editar mesa:", erro);
        throw erro;

    }

}

/* ==========================================================
   ALTERAR STATUS
========================================================== */

export async function alterarStatusMesa(id, status) {

    try {

        await updateDoc(
            doc(db, "mesas", id),
            {
                status,
                updatedAt: serverTimestamp()
            }
        );

    } catch (erro) {

        console.error("Erro ao alterar status da mesa:", erro);
        throw erro;

    }

}

/* ==========================================================
   EXCLUIR MESA
========================================================== */

export async function excluirMesa(id) {

    try {

        await deleteDoc(doc(db, "mesas", id));

    } catch (erro) {

        console.error("Erro ao excluir mesa:", erro);
        throw erro;

    }

}

/* ==========================================================
   BUSCAR MESA
========================================================== */

export async function buscarMesa(id) {

    try {

        const mesa = await getDoc(doc(db, "mesas", id));

        if (!mesa.exists()) {
            return null;
        }

        return {
            id: mesa.id,
            ...mesa.data()
        };

    } catch (erro) {

        console.error("Erro ao buscar mesa:", erro);
        throw erro;

    }

}

/* ==========================================================
   OUVIR MESAS
========================================================== */

export function ouvirMesas(callback) {

    const q = query(
        mesasRef,
        orderBy("numero", "asc")
    );

    return onSnapshot(
        q,
        (snapshot) => {

            const mesas = [];

            snapshot.forEach((docItem) => {
                mesas.push({
                    id: docItem.id,
                    ...docItem.data()
                });
            });

            callback(mesas);

        },
        (erro) => {
            console.error("Erro ao ouvir mesas:", erro);
        }
    );

}

/* ==========================================================
   CONTADORES
========================================================== */

export function contarMesas(mesas) {

    return {
        total: mesas.length,
        livres: mesas.filter(m => m.status === "LIVRE").length,
        ocupadas: mesas.filter(m => m.status === "OCUPADA").length,
        reservadas: mesas.filter(m => m.status === "RESERVADA").length,
        manutencao: mesas.filter(m => m.status === "MANUTENCAO").length,
        pessoas: mesas.reduce((total, mesa) => total + Number(mesa.pessoas || 0), 0)
    };

}