import {
  collection,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../../../js/services/firebase.js";


export async function limparColecao(nomeColecao){

    const snapshot =
        await getDocs(
            collection(db,nomeColecao)
        );


    if(snapshot.empty)
        return;


    const batch =
        writeBatch(db);


    snapshot.forEach((item)=>{

        batch.delete(item.ref);

    });


    await batch.commit();

}



export async function limparVendasProdutos(){

    const snapshot =
        await getDocs(
            collection(db,"produtos")
        );


    const batch =
        writeBatch(db);


    snapshot.forEach((item)=>{

        batch.update(
            item.ref,
            {
                vendas:0
            }
        );

    });


    await batch.commit();

}



export const limparProdutos =
    ()=>limparColecao("produtos");


export const limparTaxasEntrega =
    ()=>limparColecao("taxasEntrega");