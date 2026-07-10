import {
  garantirClienteAnonimo
} from "../services/customers.js";


import {
  ouvirPedidosCliente
} from "../services/orders.js";



const lista =
document.getElementById(
  "listaPedidos"
);


const nomeCliente =
document.getElementById(
  "nomeCliente"
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



function etapaStatus(status){


const etapas=[
"RECEBIDO",
"PREPARANDO",
"PRONTO",
"ENTREGUE"
];


const nomes=[
"Recebido",
"Preparando",
"Pronto",
"Entregue"
];


const atual =
etapas.indexOf(status);



return etapas.map(
(etapa,index)=>{


let icone="⚪";


if(index < atual)
icone="🟢";


if(index === atual)
icone="🟢";


return `
<div class="status-etapa">

${icone}

${nomes[index]}

</div>
`;

}

).join("");

}




function renderPedidos(pedidos){


if(!pedidos.length){

lista.innerHTML=`

<div class="pedido-vazio">

Você ainda não possui pedidos.

</div>

`;

return;

}



lista.innerHTML =
pedidos.map(
pedido=>{


const itens =
pedido.itens
.map(
item => {

let adicionais = "";

if(item.adicionais && item.adicionais.length){

adicionais = `
<br>
&nbsp;&nbsp;➕ ${
item.adicionais
.map(a => a.nome)
.join(", ")
}
`;

}


let observacao = "";

if(item.observacaoItem && item.observacaoItem.trim()){

observacao = `
<br>
&nbsp;&nbsp;📝 Obs: ${item.observacaoItem}
`;

}


return `
${item.quantidade}x ${item.nome}
${adicionais}
${observacao}
`;

}
)
.join("<br>");



return `

<div class="pedido-card">


<h3>
#${pedido.numeroPedido || pedido.id.slice(0,6)}
</h3>


<p>
${itens}
</p>


<strong>
${formatarMoeda(pedido.valorTotal)}
</strong>



<div class="barra-status">

${etapaStatus(
pedido.status
)}

</div>


</div>

`;

}

).join("");

}




async function iniciar(){


const user =
await garantirClienteAnonimo();



ouvirPedidosCliente(
user.uid,
(pedidos)=>{


if(pedidos[0]?.cliente){

nomeCliente.innerText =
pedidos[0].cliente;

}


renderPedidos(pedidos);


}

);


}



iniciar();