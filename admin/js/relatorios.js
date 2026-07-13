import {
    ouvirPedidos
} from "../../js/services/orders.js";


import {
    ouvirClientes
} from "../../js/services/clients.js";


import {
    ouvirProdutos
} from "../../js/services/products.js";



let pedidos=[];
let clientes=[];
let produtos=[];



const faturamento =
document.getElementById("relatorioFaturamento");


const totalPedidos =
document.getElementById("relatorioPedidos");


const totalProdutos =
document.getElementById("relatorioProdutos");


const totalClientes =
document.getElementById("relatorioClientes");



const rankingProdutos =
document.getElementById("rankingProdutos");


const rankingClientes =
document.getElementById("rankingClientes");



/*
==================================
FIRESTORE
==================================
*/


ouvirPedidos(data=>{

    pedidos=data;

    atualizar();

});



ouvirClientes(data=>{

    clientes=data;

    atualizar();

});



ouvirProdutos(data=>{

    produtos=data;

    atualizar();

});






function atualizar(){


const pedidosValidos =
pedidos.filter(
p=>p.status!=="CANCELADO"
);



const faturamentoTotal =
pedidosValidos.reduce(
(total,p)=>
total+
Number(p.valorTotal||0),
0
);



const produtosVendidos =
pedidosValidos.reduce(
(total,p)=>

total +
(p.itens||[])
.reduce(
(a,item)=>
a+
Number(item.quantidade||1),
0
)

,0);



faturamento.textContent =
moeda(faturamentoTotal);



totalPedidos.textContent =
pedidosValidos.length;



totalProdutos.textContent =
produtosVendidos;



totalClientes.textContent =
clientes.length;



montarRankingProdutos();

montarRankingClientes();

graficoFaturamento();

graficoProdutos();

graficoPagamentos();

graficoPedidos();


}






/*
==================================
RANKING PRODUTOS
==================================
*/


function montarRankingProdutos(){


if(!rankingProdutos)
return;



const lista=[];



pedidos.forEach(pedido=>{


(pedido.itens||[])
.forEach(item=>{


let atual =
lista.find(
p=>p.nome===item.nome
);


if(!atual){

atual={
nome:item.nome,
quantidade:0,
faturamento:0
};

lista.push(atual);

}



atual.quantidade +=
Number(item.quantidade||1);


atual.faturamento +=
Number(item.subtotal||0);


});


});



lista.sort(
(a,b)=>
b.quantidade-a.quantidade
);



rankingProdutos.innerHTML =
lista.map((p,i)=>`

<tr>

<td>${i+1}</td>

<td>${p.nome}</td>

<td>-</td>

<td>${p.quantidade}</td>

<td>${moeda(p.faturamento)}</td>


</tr>

`).join("");

}





/*
==================================
RANKING CLIENTES
==================================
*/


function montarRankingClientes(){

if(!rankingClientes)
return;


const lista=[];


pedidos
.filter(p=>p.status!=="CANCELADO")
.forEach(pedido=>{


let cliente =
lista.find(
c=>c.nome===pedido.cliente
);


if(!cliente){

cliente={
nome:pedido.cliente || "Não informado",
pedidos:0,
total:0,
ultima:null
};

lista.push(cliente);

}


cliente.pedidos++;

cliente.total += Number(pedido.valorTotal||0);


if(
!cliente.ultima ||
pedido.criadoEm?.seconds >
cliente.ultima.seconds
){

cliente.ultima = pedido.criadoEm;

}


});


lista.sort(
(a,b)=>b.total-a.total
);



rankingClientes.innerHTML =

lista.map(cliente=>`

<tr>

<td>${cliente.nome}</td>

<td>${cliente.pedidos}</td>

<td>${moeda(cliente.total)}</td>

<td>
${
cliente.ultima
?
new Date(cliente.ultima.seconds*1000)
.toLocaleDateString("pt-BR")
:
"-"
}

</td>

</tr>

`).join("");

}





/*
==================================
GRÁFICOS
==================================
*/


function graficoProdutos(){


const canvas =
document.getElementById("graficoProdutos");


if(!canvas || !window.Chart)
return;


if(canvas.chart)
canvas.chart.destroy();



canvas.chart =
new Chart(canvas,{

type:"bar",

data:{

labels:
produtos
.slice(0,5)
.map(p=>p.nome),


datasets:[{

label:"Vendas",

data:
produtos
.slice(0,5)
.map(p=>p.vendas||0)

}]

}

});


}



function graficoPedidos(){

const canvas =
document.getElementById("graficoPedidos");


if(!canvas || !window.Chart)
return;



if(canvas.chart)
canvas.chart.destroy();



canvas.chart =
new Chart(canvas,{

type:"line",

data:{

labels:["Hoje"],

datasets:[{

label:"Pedidos",

data:[pedidos.length]

}]

}

});


}






function moeda(valor){

return Number(valor||0)
.toLocaleString(
"pt-BR",
{
style:"currency",
currency:"BRL"
}
);

}

function graficoFaturamento(){

const canvas =
document.getElementById("graficoFaturamento");


if(!canvas || !window.Chart)
return;


if(canvas.chart)
canvas.chart.destroy();



const dados =
pedidos
.filter(p=>p.status!=="CANCELADO")
.map(p=>Number(p.valorTotal||0));


canvas.chart =
new Chart(canvas,{

type:"line",

data:{

labels:
pedidos
.filter(p=>p.status!=="CANCELADO")
.map(p=>p.numeroPedido),


datasets:[{

label:"Faturamento",

data:dados

}]

}

});


}

function graficoPagamentos(){

const canvas =
document.getElementById("graficoPagamentos");


if(!canvas || !window.Chart)
return;


if(canvas.chart)
canvas.chart.destroy();



const formas={};


pedidos
.filter(p=>p.status!=="CANCELADO")
.forEach(p=>{


let forma =
p.pagamentoMetodo || "OUTRO";


formas[forma] =
(formas[forma]||0)+1;


});



canvas.chart =
new Chart(canvas,{

type:"doughnut",

data:{

labels:
Object.keys(formas),


datasets:[{

label:"Pagamentos",

data:
Object.values(formas)

}]

}

});


}