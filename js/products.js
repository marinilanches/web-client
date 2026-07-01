import { db } from "./firebase.js";
import {
    collection,
    getDocs,
    onSnapshot
} from "firebase/firestore";

export async function loadProducts() {

    const snap = await getDocs(collection(db, "produtos"));

    const container = document.getElementById("produtos");

    if (!container) return;

    container.innerHTML = "";

    snap.forEach((doc) => {

        const p = doc.data();

        container.innerHTML += `

            <div class="item">

                <div>

                    <h4>${p.nome}</h4>

                    <p>${p.descricao ?? ""}</p>

                    <span>R$ ${Number(p.preco).toFixed(2)}</span>

                </div>

                <button
                    class="btnAdd"
                    data-nome="${p.nome}"
                    data-preco="${p.preco}">

                    Adicionar

                </button>

            </div>

        `;

    });

}

export function ouvirProdutos(callback){

    return onSnapshot(
        collection(db,"produtos"),
        callback
    );

}