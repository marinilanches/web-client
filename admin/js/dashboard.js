<<<<<<< HEAD
import { carregarSidebar } 
from "../components/sidebar.js";
=======
import { carregarSidebar }
from "../components/sidebar.js";
>>>>>>> d39abec0ce4d740fe78a1dbba3c43894371ac0cc

<<<<<<< HEAD
import { carregarHeader }
from "../components/header.js";


import { ouvirPedidos }
from "../../js/services/orders.js";


import { listarProdutosMaisVendidos }
from "../../js/services/products.js";


=======
import { carregarHeader }
from "../components/header.js";

import { ouvirPedidos }
from "../../js/services/orders.js";

import { listarProdutosMaisVendidos }
from "../../js/services/products.js";

import {
    atualizarPedidos,
    atualizarFaturamento
} from "../components/cards.js";


>>>>>>> d39abec0ce4d740fe78a1dbba3c43894371ac0cc
carregarSidebar();
carregarHeader();
<<<<<<< HEAD



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



document.querySelector("#cardFinalizados")
.innerHTML=
`📦<h3>${finalizados}</h3>Pedidos Finalizados`;



document.querySelector("#cardPreparo")
.innerHTML=
`👨‍🍳<h3>${preparo}</h3>Em Preparo`;



document.querySelector("#cardProntos")
.innerHTML=
`✅<h3>${prontos}</h3>Prontos`;



document.querySelector("#cardEntregues")
.innerHTML=
`🚚<h3>${entregues}</h3>Entregues`;



document.querySelector("#cardFaturamento")
.innerHTML=
`💰<h3>${moeda(faturamento)}</h3>Hoje`;



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
=======



const moeda = valor =>
valor.toLocaleString(
"pt-BR",
{
style:"currency",
currency:"BRL"
}
);



ouvirPedidos(pedidos=>{


const finalizados =
pedidos.filter(
p =>
["ENTREGUE","FINALIZADO"]
.includes(p.status)
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


if(produtos.length===0){

document.querySelector("#maisVendidos").innerHTML=
"Nenhum produto vendido.";

}
}
)
>>>>>>> d39abec0ce4d740fe78a1dbba3c43894371ac0cc