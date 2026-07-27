import { carregarSidebar }
from "../components/sidebar.js";

import { carregarHeader }
from "../components/header.js";


import { ouvirPedidos }
from "../../js/services/orders.js";


import { ouvirConfiguracoes }
from "../../js/services/config.js";


import { isStoreOpen }
from "../../js/services/store-hours.js";


import { listarProdutosMaisVendidos }
from "../../js/services/products.js";


import {

    atualizarPedidos,
    atualizarFaturamento,
    atualizarRodape,
    atualizarLoja

}

from "../components/cards.js";

const moeda = valor =>

valor.toLocaleString(

    "pt-BR",

    {
        style:"currency",
        currency:"BRL"
    }

);

carregarSidebar();

carregarHeader();


// ======================================================
// PEDIDOS
// ======================================================

function sincronizarCardsPedidos(pedidos){


    const finalizados =

    pedidos.filter(

        pedido =>
        pedido.status === "ENTREGUE"

    ).length;



    const preparo =

    pedidos.filter(

        pedido =>
        pedido.status === "PREPARANDO"

    ).length;



    const prontos =

    pedidos.filter(

        pedido =>
        pedido.status === "PRONTO"

    ).length;



    const entregues =

    pedidos.filter(

        pedido =>
        pedido.status === "ENTREGUE"

    ).length;



    const faturamento =

    pedidos

    .filter(

        pedido =>
        pedido.status === "ENTREGUE"

    )

    .reduce(

        (total, pedido)=>

        total + Number(pedido.valorTotal || 0),

        0

    );



    atualizarPedidos(

        finalizados,

        preparo,

        prontos,

        entregues

    );


    atualizarFaturamento(

        faturamento

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

}



ouvirPedidos(pedidos=>{


    sincronizarCardsPedidos(

        pedidos

    );



    const lista =

    document.querySelector(

        "#ultimosPedidos"

    );



    if(lista){


        lista.innerHTML =

        pedidos

        .slice(0,5)

        .map(

            pedido =>

            `

            <div>

                #${pedido.numeroPedido}

                -

                ${pedido.cliente}

                -

                ${moeda(

                    Number(

                        pedido.valorTotal || 0

                    )

                )}

            </div>

            `

        )

        .join("");

    }


});

// ======================================================
// STATUS DA LOJA
// ======================================================

ouvirConfiguracoes(config=>{


    if(!config) return;


    const aberta =

    isStoreOpen(

        config.funcionamento

    );


    atualizarLoja(

        aberta

    );


});



// ======================================================
// PRODUTOS MAIS VENDIDOS
// ======================================================

listarProdutosMaisVendidos()

.then(produtos=>{


    document.querySelector("#maisVendidos")

    .innerHTML =

    produtos.map(p=>

    `

    <div>

        🔥 ${p.nome}

        (${p.vendas})

    </div>

    `

    ).join("");


});