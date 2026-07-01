import { carregarSidebar } from "../components/sidebar.js";
import { carregarHeader } from "../components/header.js";

window.addEventListener("DOMContentLoaded", async () => {

    carregarSidebar();

    carregarHeader();

    const pagina = window.location.pathname.split("/").pop();

    console.log("Página:", pagina);

    switch (pagina) {

        case "index.html":
            await import("./dashboard.js");
            break;

        case "pedidos.html":
            await import("./pedidos.js");
            break;

        case "produtos.html":
            await import("./produtos.js");
            break;

        case "clientes.html":
            await import("./clientes.js");
            break;

        case "mesas.html":
            await import("./mesas.js");
            break;

        case "financeiro.html":
            await import("./financeiro.js");
            break;

        case "relatorios.html":
            await import("./relatorios.js");
            break;

        case "whatsapp.html":
            await import("./whatsapp.js");
            break;

        case "impressora.html":
            await import("./impressora.js");
            break;

        case "configuracoes.html":
            await import("./config.js");
            break;

    }

});