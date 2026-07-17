const {
    getFirestore
}=require("firebase-admin/firestore");


const {
    solicitarEntregador
}=require("./bee.orders");


const db=getFirestore();



function iniciarBeeListener(){


db.collection("pedidos")
.onSnapshot(async snapshot=>{


for(const change of snapshot.docChanges()){


if(
change.type !== "modified"
)
continue;



const pedido={
id:change.doc.id,
...change.doc.data()
};



if(
pedido.status !== "PRONTO"
)
continue;



if(
pedido.tipo !== "Delivery"
)
continue;



if(
pedido.entrega?.idEntrega
)
continue;



try{


console.log(
"[BEE] Solicitando entregador..."
);



const entrega =
await solicitarEntregador(
pedido
);



await db.collection("pedidos")
.doc(pedido.id)
.update({

entrega:{
plataforma:"BEE",
status:"SOLICITADO",
idEntrega:
entrega.id || "XXX"
}

});


console.log(
"[BEE] Entregador solicitado"
);



}catch(error){


console.error(
"[BEE] Erro:",
error
);


}



}



});


}



module.exports={
iniciarBeeListener
};