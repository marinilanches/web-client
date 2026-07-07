import { db } from "./firebase.js";

import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    doc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ==========================================================
   MESA FÁCIL
   PRODUCTS SERVICE
========================================================== */

const produtosRef = collection(db, "produtos");

/* ==========================================================
   CRIAR PRODUTO
========================================================== */

export async function criarProduto(dados) {

    try {

        const produto = {

            nome: dados.nome || "",
            descricao: dados.descricao || "",
            preco: Number(dados.preco || 0),
            categoria: dados.categoria || "",
            ativo: dados.ativo ?? true,
            vendas: Number(dados.vendas || 0),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()

        };

        return await addDoc(produtosRef, produto);

    } catch (erro) {

        console.error("Erro ao criar produto:", erro);
        throw erro;

    }

}

/* ==========================================================
   EDITAR PRODUTO
========================================================== */

export async function editarProduto(id, dados) {

    try {

        await updateDoc(
            doc(db, "produtos", id),
            {
                ...dados,
                updatedAt: serverTimestamp()
            }
        );

    } catch (erro) {

        console.error("Erro ao editar produto:", erro);
        throw erro;

    }

}

/* ==========================================================
   EXCLUIR PRODUTO
========================================================== */

export async function excluirProduto(id) {

    try {

        await deleteDoc(doc(db, "produtos", id));

    } catch (erro) {

        console.error("Erro ao excluir produto:", erro);
        throw erro;

    }

}

/* ==========================================================
   BUSCAR PRODUTO
========================================================== */

export async function buscarProduto(id) {

    try {

        const produto = await getDoc(doc(db, "produtos", id));

        if (!produto.exists()) {
            return null;
        }

        return {
            id: produto.id,
            ...produto.data()
        };

    } catch (erro) {

        console.error("Erro ao buscar produto:", erro);
        throw erro;

    }

}

/* ==========================================================
   LISTAR PRODUTOS
========================================================== */

export async function listarProdutos() {

    try {

        const q = query(produtosRef, orderBy("nome", "asc"));
        const snap = await getDocs(q);

        const produtos = [];

        snap.forEach((docItem) => {
            produtos.push({
                id: docItem.id,
                ...docItem.data()
            });
        });

        return produtos;

    } catch (erro) {

        console.error("Erro ao listar produtos:", erro);
        throw erro;

    }

}

/* ==========================================================
   OUVIR PRODUTOS
========================================================== */

export function ouvirProdutos(callback) {

    const q = query(produtosRef, orderBy("nome", "asc"));

    return onSnapshot(
        q,
        (snapshot) => {

            const produtos = [];

            snapshot.forEach((docItem) => {
                produtos.push({
                    id: docItem.id,
                    ...docItem.data()
                });
            });

            callback(produtos);

        },
        (erro) => {
            console.error("Erro ao ouvir produtos:", erro);
        }
    );

}

/* ==========================================================
   CLIENTE: CARREGAR PRODUTOS NA TELA
========================================================== */

export async function loadProducts() {

    const container = document.getElementById("produtos");
    if (!container) return;

    const produtos = await listarProdutos();

    container.innerHTML = "";

    produtos.forEach((p) => {

        container.innerHTML += `
            <div class="item">
                <div>
                    <h4>${p.nome}</h4>
                    <p>${p.descricao ?? ""}</p>
                    <span>R$ ${Number(p.preco || 0).toFixed(2)}</span>
                </div>

                <button
                    class="btnAdd"
                    data-nome="${p.nome}"
                    data-preco="${Number(p.preco || 0)}">
                    Adicionar
                </button>
            </div>
        `;

    });

}