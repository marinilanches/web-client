/* ==========================================================
   MESA FÁCIL
   CART SERVICE
========================================================== */

let carrinho = [];

let total = 0;

let quantidade = 0;

/* ==========================================================
   INICIALIZAÇÃO
========================================================== */

export function iniciarCarrinho() {

    carregarCarrinho();

    updateUI();

    document.addEventListener("click", (e) => {

        if (!e.target.classList.contains("btnAdd")) return;

        addItem(

            e.target.dataset.nome,

            Number(e.target.dataset.preco)

        );

    });

}

/* ==========================================================
   ADICIONAR ITEM
========================================================== */

export function addItem(nome, preco) {

    const item = carrinho.find(produto => produto.nome === nome);

    if (item) {

        item.quantidade++;

    }

    else {

        carrinho.push({

            nome,

            quantidade: 1,

            valorUnitario: preco

        });

    }

    recalcular();

}

/* ==========================================================
   REMOVER ITEM
========================================================== */

export function removerItem(nome) {

    carrinho = carrinho.filter(item => item.nome !== nome);

    recalcular();

}

/* ==========================================================
   AUMENTAR QUANTIDADE
========================================================== */

export function aumentarQuantidade(nome) {

    const item = carrinho.find(produto => produto.nome === nome);

    if (!item) return;

    item.quantidade++;

    recalcular();

}

/* ==========================================================
   DIMINUIR QUANTIDADE
========================================================== */

export function diminuirQuantidade(nome) {

    const item = carrinho.find(produto => produto.nome === nome);

    if (!item) return;

    item.quantidade--;

    if (item.quantidade <= 0) {

        removerItem(nome);

        return;

    }

    recalcular();

}

/* ==========================================================
   RECALCULAR
========================================================== */

function recalcular() {

    quantidade = 0;

    total = 0;

    carrinho.forEach(item => {

        quantidade += item.quantidade;

        total += item.quantidade * item.valorUnitario;

    });

    updateUI();

    salvarCarrinho();

}

/* ==========================================================
   ATUALIZAR UI
========================================================== */

export function updateUI() {

    const qtd = document.getElementById("qtd");

    const valor = document.getElementById("total");

    if (qtd) {

        qtd.innerText = quantidade;

    }

    if (valor) {

        valor.innerText = total.toFixed(2);

    }

}

/* ==========================================================
   LOCAL STORAGE
========================================================== */

function salvarCarrinho() {

    localStorage.setItem(

        "carrinho",

        JSON.stringify(carrinho)

    );

}

function carregarCarrinho() {

    const salvo = localStorage.getItem("carrinho");

    if (!salvo) return;

    carrinho = JSON.parse(salvo);

    recalcular();

}

/* ==========================================================
   LIMPAR
========================================================== */

export function limparCarrinho() {

    carrinho = [];

    quantidade = 0;

    total = 0;

    localStorage.removeItem("carrinho");

    updateUI();

}

/* ==========================================================
   GETTERS
========================================================== */

export function getCarrinho() {

    return carrinho;

}

export function getTotal() {

    return total;

}

export function getQuantidade() {

    return quantidade;

}