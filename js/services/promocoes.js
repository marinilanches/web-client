import { db } from "./firebase.js";

import {
collection,
getDocs,
query,
where,
orderBy,
addDoc,
updateDoc,
deleteDoc,
doc,
serverTimestamp
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const COLLECTION = "promocoes";



/* ==========================================================
LISTAR ADMIN
========================================================== */

export async function listarPromocoes(){

const ref =
collection(
db,
COLLECTION
);


const q =
query(
ref,
orderBy(
"createdAt",
"desc"
)
);


const snap =
await getDocs(q);



return snap.docs.map(d=>({

id:d.id,

...d.data()

}));

}



/* ==========================================================
LISTAR CLIENTE
========================================================== */

export async function buscarPromocoes(){

const ref =
collection(
db,
COLLECTION
);


const q =
query(
ref,
where(
"ativo",
"==",
true
),
orderBy(
"createdAt",
"desc"
)
);


const snap =
await getDocs(q);



return snap.docs.map(d=>({

id:d.id,

...d.data()

}));

}



/* ==========================================================
CRIAR
========================================================== */

export async function criarPromocao(dados){


return await addDoc(
collection(
db,
COLLECTION
),
{

...dados,

createdAt:
serverTimestamp(),

updatedAt:
serverTimestamp()

}

);

}



/* ==========================================================
ATUALIZAR
========================================================== */

export async function atualizarPromocao(
id,
dados
){


return await updateDoc(
doc(
db,
COLLECTION,
id
),
{

...dados,

updatedAt:
serverTimestamp()

}

);

}



/* ==========================================================
EXCLUIR
========================================================== */

export async function excluirPromocao(id){


return await deleteDoc(
doc(
db,
COLLECTION,
id
)

);

}



/* ==========================================================
PRODUTOS DISPONÍVEIS
========================================================== */

export async function buscarProdutosDisponiveis(){

const ref =
collection(
db,
"produtos"
);


const snap =
await getDocs(ref);



return snap.docs.map(d=>({

id:d.id,

...d.data()

}));

}