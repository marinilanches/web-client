import { carregarSidebar } 
from "../components/sidebar.js";

import { carregarHeader }
from "../components/header.js";


import { ouvirPedidos }
from "../../js/services/orders.js";


import { listarProdutosMaisVendidos }
from "../../js/services/products.js";

import {

    atualizarPedidos,

    atualizarFaturamento,

    atualizarRodape

}

from "../components/cards.js";


carregarSidebar();
carregarHeader();



const moeda = valor =>
valor.toLocaleString(
"pt-BR",
{
style:"currency",
currency:"BRL"
}
);



ouvirPedidos(pedidos=>{


let finalizados =
pedidos.filter(
p=>p.status==="ENTREGUE"
).length;


let preparo =
pedidos.filter(
p=>p.status==="PREPARANDO"
).length;


let prontos =
pedidos.filter(
p=>p.status==="PRONTO"
).length;


let entregues =
pedidos.filter(
p=>p.status==="ENTREGUE"
).length;


let faturamento =
pedidos
.filter(p=>p.status==="ENTREGUE")
.reduce(
(a,b)=>a+Number(b.valorTotal||0),
0
);



atualizarPedidos(

    finalizados,

    preparo,

    prontos,

    entregues

);

atualizarRodape(

    "cardFinalizados",

    "Hoje"

);

atualizarRodape(

    "cardPreparo",

    preparo > 0

        ? "Pedidos em andamento"

        : "Nenhum pedido"

);

atualizarRodape(

    "cardProntos",

    prontos > 0

        ? "Aguardando retirada"

        : "Nenhum pedido"

);

atualizarRodape(

    "cardEntregues",

    "Hoje"

);

atualizarFaturamento(faturamento);



const lista =
document.querySelector("#ultimosPedidos");


lista.innerHTML =
pedidos
.slice(0,5)
.map(p=>
`
<div>
#${p.numeroPedido}
-
${p.cliente}
-
${moeda(p.valorTotal)}
</div>
`
)
.join("");

});



listarProdutosMaisVendidos()
.then(produtos=>{


document.querySelector("#maisVendidos")
.innerHTML =
produtos
.map(p=>
`
<div>
🔥 ${p.nome}
(${p.vendas})
</div>
`
)
.join("");

});