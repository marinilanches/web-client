// ======================================================
// MESA FÁCIL
// COMPONENTE - CARDS DO DASHBOARD
// ======================================================

const cards = [

    {
        id: "cardFinalizados",
        classe: "card-finalizados",
        icone: "📦",
        titulo: "Pedidos Finalizados",
        valor: "0",
        footer: "Hoje"
    },

    {
        id: "cardPreparo",
        classe: "card-preparo",
        icone: "👨‍🍳",
        titulo: "Em Preparo",
        valor: "0",
        footer: "Agora"
    },

    {
        id: "cardProntos",
        classe: "card-prontos",
        icone: "✅",
        titulo: "Pedidos Prontos",
        valor: "0",
        footer: "Aguardando retirada"
    },

    {
        id: "cardEntregues",
        classe: "card-entregues",
        icone: "🚚",
        titulo: "Pedidos Entregues",
        valor: "0",
        footer: "Hoje"
    },

    {
        id: "cardLoja",
        classe: "card-loja",
        icone: "🟢",
        titulo: "Loja",
        valor: "ABERTA",
        footer: "Funcionando"
    },

    {
        id: "cardFaturamento",
        classe: "card-faturamento",
        icone: "💰",
        titulo: "Faturamento",
        valor: "R$ 0,00",
        footer: "Hoje"
    }

];

// ======================================================

function criarCard(card){

    const container = document.getElementById(card.id);

    if(!container) return;

    container.innerHTML = `

        <div class="card ${card.classe}">

            <div class="card-icon">

                ${card.icone}

            </div>

            <div class="card-title">

                ${card.titulo}

            </div>

            <div class="card-value" id="${card.id}Valor">

                ${card.valor}

            </div>

            <div class="card-footer" id="${card.id}Footer">

                ${card.footer}

            </div>

        </div>

    `;

}

// ======================================================

cards.forEach(criarCard);

// ======================================================
// FUNÇÕES DE ATUALIZAÇÃO
// ======================================================

export function atualizarCard(id, valor){

    const campo = document.getElementById(id + "Valor");

    if(campo){

        campo.innerHTML = valor;

    }

}

// ======================================================

export function atualizarRodape(id, texto){

    const campo = document.getElementById(id + "Footer");

    if(campo){

        campo.innerHTML = texto;

    }

}

// ======================================================

export function atualizarLoja(aberta){

    const valor = document.getElementById("cardLojaValor");

    const footer = document.getElementById("cardLojaFooter");

    if(!valor) return;

    if(aberta){

        valor.innerHTML = "ABERTA";

        valor.style.color = "#27ae60";

        footer.innerHTML = "Recebendo pedidos";

    }

    else{

        valor.innerHTML = "FECHADA";

        valor.style.color = "#e74c3c";

        footer.innerHTML = "Loja indisponível";

    }

}

// ======================================================

export function atualizarFaturamento(valor){

    atualizarCard(

        "cardFaturamento",

        "R$ " + Number(valor).toLocaleString(

            "pt-BR",

            {

                minimumFractionDigits:2

            }

        )

    );

}

// ======================================================

export function atualizarPedidos(

    finalizados,

    preparo,

    prontos,

    entregues

){

    atualizarCard("cardFinalizados", finalizados);

    atualizarCard("cardPreparo", preparo);

    atualizarCard("cardProntos", prontos);

    atualizarCard("cardEntregues", entregues);

}