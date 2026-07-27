import { db } from "./firebase.js";

import {
    doc,
    getDoc,
    onSnapshot
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const COLLECTION_NAME = "configuracoes";
const DOC_ID = "geral";


export async function buscarConfiguracoes() {

  const ref = doc(
    db,
    COLLECTION_NAME,
    DOC_ID
  );

  const snap = await getDoc(ref);


  if (!snap.exists()) {
    return null;
  }


  return {
    id: snap.id,
    ...snap.data()
  };
}

export function ouvirConfiguracoes(callback){

    const ref =
    doc(
        db,
        COLLECTION_NAME,
        DOC_ID
    );


    return onSnapshot(
        ref,
        snap=>{

            if(!snap.exists()){

                callback(null);
                return;

            }


            callback({

                id:snap.id,

                ...snap.data()

            });

        }
    );

}