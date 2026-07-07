import { carregarSidebar } from "../components/sidebar.js";
import { carregarHeader } from "../components/header.js";
import { protegerPaginaAdmin } from "../../js/services/auth.js";

/* ==========================================================
   MESA FÁCIL
   ADMIN APP
========================================================== */

async function iniciarAdmin() {

    const autorizado = protegerPaginaAdmin();

    if (!autorizado) {
        return;
    }

    carregarSidebar();
    carregarHeader();

    const pagina = window.location.pathname.split("/").pop() || "index.html";

    console.log("Página:", pagina);

    switch (pagina) {

        case "index.html":
            console.log("Carregando dashboard.js");
            await import("./dashboard.js");
            break;

        case "pedidos.html":
            console.log("Carregando pedidos.js");
            await import("./pedidos.js");
            break;

        case "produtos.html":
            console.log("Carregando produtos.js");
            await import("./produtos.js");
            break;

        case "clientes.html":
            console.log("Carregando clientes.js");
            await import("./clientes.js");
            break;

        case "mesas.html":
            console.log("Carregando mesas.js");
            await import("./mesas.js");
            break;

        case "financeiro.html":
            console.log("Carregando financeiro.js");
            await import("./financeiro.js");
            break;

        case "relatorios.html":
            console.log("Carregando relatorios.js");
            await import("./relatorios.js");
            break;

        case "whatsapp.html":
            console.log("Carregando whatsapp.js");
            await import("./whatsapp.js");
            break;

        case "impressora.html":
            console.log("Carregando impressora.js");
            await import("./impressora.js");
            break;

        case "configuracoes.html":
        case "config.html":
            console.log("Carregando config.js");
            await import("./config.js");
            break;

        default:
            console.warn("Nenhum módulo encontrado para a página:", pagina);
            break;

    }

}

iniciarAdmin();