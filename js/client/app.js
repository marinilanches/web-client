import { loadProducts } from "../services/products.js";
import { iniciarCarrinho } from "./cart.js";
import { iniciarCheckout } from "./checkout.js";

window.addEventListener("DOMContentLoaded", async () => {
    await loadProducts();
    iniciarCarrinho();
    iniciarCheckout();
});