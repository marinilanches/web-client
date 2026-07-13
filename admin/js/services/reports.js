import { db } from "../../../js/services/firebase.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


export async function carregarDadosRelatorios(){

    const pedidosSnap =
        await getDocs(collection(db,"pedidos"));


    const clientesSnap =
        await getDocs(collection(db,"clientes"));


    const produtosSnap =
        await getDocs(collection(db,"produtos"));


    const pedidos=[];
    const clientes=[];
    const produtos=[];


    pedidosSnap.forEach(doc=>{
        pedidos.push({
            id:doc.id,
            ...doc.data()
        });
    });


    clientesSnap.forEach(doc=>{
        clientes.push({
            id:doc.id,
            ...doc.data()
        });
    });


    produtosSnap.forEach(doc=>{
        produtos.push({
            id:doc.id,
            ...doc.data()
        });
    });



    return {
        pedidos,
        clientes,
        produtos
    };

}