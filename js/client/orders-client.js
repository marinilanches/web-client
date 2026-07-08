import {
  garantirClienteAuth,
  buscarCliente
} from "../services/customers.js";

import {
  ouvirPedidosCliente
} from "../services/orders.js";


const container =
document.getElementById(
  "meusPedidos"
);


function formatarMoeda(valor){

return Number(valor || 0)
.toLocaleString(
"pt-BR",
{
 style:"currency",
 currency:"BRL"
}
);

}



function statusTexto(status){

switch(status){

case "RECEBIDO":
return "🟡 Recebido";

case "PREPARANDO":
return "👨‍🍳 Preparando";

case "PRONTO":
return "✅ Pronto";

case "ENTREGUE":
return "🚚 Entregue";

default:
return status || "—";

}

}



function renderPedidos(pedidos, cliente){


if(!pedidos.length){

container.innerHTML=`

<div class="highlight-card">

<h4>
Olá ${cliente?.nome || "cliente"} 👋
</h4>

<p class="text-secondary mb-0">
Você ainda não possui pedidos.
</p>

</div>

`;

return;

}



container.innerHTML=`

<h4 class="fw-bold mb-3">
Olá ${cliente?.nome || "cliente"} 👋
</h4>


<div class="d-flex flex-column gap-3">


${pedidos.map(pedido=>`

<div class="product-card">

<div class="card-body">


<div class="d-flex justify-content-between">


<h4 class="product-title">
#${pedido.numeroPedido || pedido.id.slice(0,6)}
</h4>


<strong class="product-price-value">
${formatarMoeda(pedido.valorTotal)}
</strong>


</div>



<p class="product-description">

${pedido.itens?.map(
item =>
`${item.quantidade || 1}x ${item.nome}`
).join("<br>") || "Sem itens"}

</p>



<div class="badge text-bg-danger">

${statusTexto(pedido.status)}

</div>



<a 
href="./status.html?id=${pedido.id}"
class="btn btn-danger w-100 mt-3">

Ver status

</a>



</div>

</div>


`).join("")}


</div>

`;

}



export async function iniciarPedidosCliente(){


if(!container)
return;


const user =
await garantirClienteAuth();



const cliente =
await buscarCliente();



ouvirPedidosCliente(

user.uid,

(pedidos)=>{


renderPedidos(
pedidos,
cliente
);


}

);


}