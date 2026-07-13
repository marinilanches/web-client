import {
    limparColecao,
    limparProdutos,
    limparVendasProdutos,
    limparTaxasEntrega
} from "./services/limpeza.js";
import { toast } from "../components/toast.js";
import {
    db
} from "../../js/services/firebase.js";


import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* ==========================================================
   ELEMENTOS
========================================================== */


const botoesLimpeza =
    document.querySelectorAll(".btn-ferramenta");


const btnLimparCarrinho =
    document.getElementById("limparCarrinho");


const btnGerarClientes =
    document.getElementById("gerarClientesTeste");


const btnGerarPedidos =
    document.getElementById("gerarPedidosTeste");


const btnResetConfig =
    document.getElementById("resetConfiguracoes");



const statusEl =
    document.getElementById("statusFerramentas");



/* ==========================================================
   ESTADO
========================================================== */


let ultimaAcao = null;



/* ==========================================================
   HELPERS
========================================================== */


function formatarData(data){

    if(!data){
        return "--";
    }

    return new Date(data)
        .toLocaleString("pt-BR");

}



function atualizarStatus(texto){

    if(statusEl){

        statusEl.textContent = texto;

    }

}



/* ==========================================================
   RENDER
========================================================== */


function renderStatus(){

    if(!statusEl){
        return;
    }


    if(ultimaAcao){

        statusEl.textContent =
            `Última ação: ${ultimaAcao.nome} às ${formatarData(ultimaAcao.data)}`;

    }else{

        statusEl.textContent =
            "Nenhuma ação executada.";

    }

}



/* ==========================================================
   LIMPEZA FIRESTORE
========================================================== */


async function executarLimpeza(colecao){

    try{


        const confirmar =
            confirm(
                `Deseja realmente apagar todos os dados de ${colecao}?`
            );


        if(!confirmar){

            return;

        }



        atualizarStatus(
            `Limpando ${colecao}...`
        );



        await limparColecao(
            colecao
        );



        ultimaAcao = {

            nome:
                `Limpeza ${colecao}`,

            data:
                new Date()

        };



        renderStatus();



        toast(
            `${colecao} limpo com sucesso.`
        );



    }catch(erro){


        console.error(
            `Erro ao limpar ${colecao}:`,
            erro
        );


        toast(
            "Erro ao executar limpeza."
        );


        atualizarStatus(
            "Erro ao executar ação."
        );


    }

}

/* ======================================================
   GERAR CLIENTES DE TESTE
====================================================== */

async function gerarClientesTeste(){

    const clientes = [

        {
            id:"teste001",
            nome:"Cliente Teste 1",
            telefone:"19999999991"
        },

        {
            id:"teste002",
            nome:"Cliente Teste 2",
            telefone:"19999999992"
        },

        {
            id:"teste003",
            nome:"Cliente Teste 3",
            telefone:"19999999993"
        }

    ];


    for(const cliente of clientes){

        await setDoc(
            doc(
                db,
                "clientes",
                cliente.id
            ),
            {
                nome:cliente.nome,
                telefone:cliente.telefone,
                criadoEm:serverTimestamp()
            }
        );

    }

}



/* ======================================================
   GERAR PEDIDOS DE TESTE
====================================================== */

async function gerarPedidosTeste(){

    const pedidos = [
        {
            numeroPedido:"TEST001",
            cliente:"Cliente Teste 1",
            telefone:"(19)99999-9991",
            tipo:"Retirada",
            pagamentoMetodo:"PIX",
            status:"RECEBIDO",
            valorSubtotal:30,
            taxaEntrega:0,
            valorTotal:30,
            itens:[
                {
                    nome:"X-Bacon",
                    quantidade:1,
                    valorUnitario:30,
                    adicionais:[]
                }
            ]
        }
    ];


    for(const pedido of pedidos){

        await setDoc(

            doc(
                db,
                "pedidos",
                pedido.numeroPedido
            ),

            {
                ...pedido,
                origem:"TESTE",
                criadoEm:serverTimestamp(),
                atualizadoEm:serverTimestamp(),
                impresso:false
            }

        );

    }

}



/* ======================================================
   RESETAR CONFIGURAÇÕES
====================================================== */

async function resetarConfiguracoes(){

    const colecoes = [

        "configuracoes",
        "taxasEntrega",
        "mesas"

    ];


    for(const nome of colecoes){

        await limparColecao(nome);

    }

}



/* ==========================================================
   CARRINHO LOCAL
========================================================== */


function limparCarrinhoLocal(){


    localStorage.removeItem(
        "mesaFacilCarrinho"
    );


    ultimaAcao = {

        nome:
            "Limpeza do carrinho local",

        data:
            new Date()

    };


    renderStatus();


    toast(
        "Carrinho local removido."
    );


}

/* ==========================================================
   EVENTOS
========================================================== */


botoesLimpeza.forEach((botao)=>{


    botao.addEventListener(
        "click",
        ()=>{


            executarLimpeza(
                botao.dataset.colecao
            );


        }
    );


});



btnLimparCarrinho
?.addEventListener(
    "click",
    limparCarrinhoLocal
);

document
.getElementById("limparProdutos")
?.addEventListener(
    "click",
    async()=>{


        if(!confirm(
            "Excluir todos os produtos?"
        ))
        return;


        await limparProdutos();


        toast(
            "Produtos removidos."
        );

    }
);



document
.getElementById("limparVendasProdutos")
?.addEventListener(
    "click",
    async()=>{


        await limparVendasProdutos();


        toast(
            "Vendas zeradas."
        );

    }
);



document
.getElementById("limparTaxasEntrega")
?.addEventListener(
    "click",
    async()=>{


        if(!confirm(
            "Excluir bairros cadastrados?"
        ))
        return;


        await limparTaxasEntrega();


        toast(
            "Bairros removidos."
        );

    }
);



btnGerarClientes
?.addEventListener(
    "click",
    async ()=>{

        try{

            atualizarStatus(
                "Gerando clientes de teste..."
            );


            await gerarClientesTeste();


            ultimaAcao = {

                nome:
                    "Clientes de teste gerados",

                data:
                    new Date()

            };


            renderStatus();


            toast(
                "Clientes de teste criados."
            );


        }catch(erro){

            console.error(
                erro
            );

            toast(
                "Erro ao gerar clientes."
            );

        }

    }
);



btnGerarPedidos
?.addEventListener(
    "click",
    async ()=>{

        try{

            atualizarStatus(
                "Gerando pedidos de teste..."
            );


            await gerarPedidosTeste();


            ultimaAcao = {

                nome:
                    "Pedidos de teste gerados",

                data:
                    new Date()

            };


            renderStatus();


            toast(
                "Pedidos de teste criados."
            );


        }catch(erro){

            console.error(
                erro
            );

            toast(
                "Erro ao gerar pedidos."
            );

        }

    }
);



btnResetConfig
?.addEventListener(
    "click",
    async ()=>{

        try{


            const confirmar =
                confirm(
                    "Resetar configurações, taxas e mesas?"
                );


            if(!confirmar)
                return;



            atualizarStatus(
                "Resetando configurações..."
            );



            await resetarConfiguracoes();



            ultimaAcao = {

                nome:
                    "Configurações resetadas",

                data:
                    new Date()

            };


            renderStatus();



            toast(
                "Configurações resetadas."
            );


        }catch(erro){


            console.error(
                erro
            );


            toast(
                "Erro ao resetar configurações."
            );


        }

    }
);



/* ==========================================================
   INIT
========================================================== */


function iniciarFerramentas(){

    console.log(
        "Ferramentas carregadas."
    );


    renderStatus();

}



iniciarFerramentas();