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

const atual = etapas.indexOf(status);


if(status === "CANCELADO"){

return `
<div class="status-cancelado">
🔴 Pedido cancelado
</div>
`;

}



const entregue = status === "ENTREGUE";


const progresso =
entregue
? 76
: atual <= 0
? 0
: (atual / (etapas.length - 1)) * 76;



return `

<div class="status-progresso">

<div class="progresso-linha"></div>

<div 
class="progresso-linha-ativa"
style="width:${progresso}%">
</div>


<div class="progresso-etapas">

${etapas.map(
(etapa,index)=>{


let classe="";

let icone="⚪";



// Pedido entregue:
// todas as etapas concluídas
if(entregue){

classe="concluida";
icone="🟢";

}



// etapas anteriores
else if(index < atual){

classe="concluida";
icone="🟢";

}



// etapa atual
else if(index === atual){

classe="ativa";
icone="🟢";

}



return `

<div class="progresso-etapa ${classe}">

<div class="progresso-bolinha">
${icone}
</div>

<span>
${nomes[index]}
</span>

</div>

`;

}

).join("")}

</div>

</div>

`;

}



function renderPedidos(pedidos){

if(!pedidos.length){

lista.innerHTML=`

Você ainda não possui pedidos.

`;

return;

}



lista.innerHTML =
pedidos.map(
pedido=>{


const itens =
pedido.itens
.map(
item=>{


let adicionais="";


if(item.adicionais && item.adicionais.length){

adicionais = `<br>
&nbsp;&nbsp;➕ ${
item.adicionais
.map(a=>a.nome)
.join(", ")
}`;

}



let observacao="";


if(
item.observacaoItem &&
item.observacaoItem.trim()
){

observacao = `<br>
&nbsp;&nbsp;📝 Obs: ${item.observacaoItem}`;

}



return `${item.quantidade}x ${item.nome}
${adicionais}
${observacao}`;

}

)
.join("");



return `


${etapaStatus(
pedido.status
)}


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