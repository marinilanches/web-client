console.log("produtos.js carregado");

import { carregarSidebar } from "../components/sidebar.js";
import { carregarHeader } from "../components/header.js";
import { abrirModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

carregarSidebar();
carregarHeader();

const btn=document.getElementById("novoProduto");

btn?.addEventListener("click",()=>{

    abrirModal(

        "Novo Produto",

        `

        <label>

            Nome

        </label>

        <input type="text" id="nomeProduto">

        <br><br>

        <label>

            Preço

        </label>

        <input type="number" id="precoProduto">

        <br><br>

        <button id="salvarProduto">

            Salvar

        </button>

        `

    );

    document
    .getElementById("salvarProduto")
    .addEventListener("click",()=>{

        toast("Produto salvo!");

    });

});