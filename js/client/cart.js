import { listarAdicionais } from "../services/additionals.js";

/* ==========================================================
   MESA FÁCIL
   CART SERVICE
   Carrinho com suporte a personalização / adicionais
========================================================== */

let carrinho = [];
let total = 0;
let quantidade = 0;

let adicionaisGlobaisCache = [];
let adicionaisGlobaisCarregados = false;

/* ==========================================================
   INICIALIZAÇÃO
========================================================== */

export function iniciarCarrinho() {
  carregarCarrinho();
  sincronizarTipoPedido();
  iniciarEventosCarrinho();
  updateUI();
}

/* ==========================================================
   EVENTOS
========================================================== */

function iniciarEventosCarrinho() {
  document.addEventListener("click", async (e) => {
    const btnAdd = e.target.closest(".btnAdd");

    if (btnAdd) {
      try {
        const produtoRaw = btnAdd.dataset.produto;

        if (!produtoRaw) return;

        const produto = JSON.parse(decodeURIComponent(produtoRaw));

        if (produtoTemPersonalizacao(produto)) {
          await carregarAdicionaisGlobais();

          abrirModalPersonalizacao(produto);
        } else {
          addItem(
            produto.id,
            produto.nome,
            Number(produto.preco || 0),
            produto.imagem || "",
          );

          abrirCarrinhoNoMobile();
        }
      } catch (erro) {
        console.error("Erro ao adicionar produto:", erro);
      }

      return;
    }

    const btnMais = e.target.closest(".btn-cart-plus");

    if (btnMais) {
      aumentarQuantidade(btnMais.dataset.key);
      return;
    }

    const btnMenos = e.target.closest(".btn-cart-minus");

    if (btnMenos) {
      diminuirQuantidade(btnMenos.dataset.key);
      return;
    }

    const btnRemover = e.target.closest(".btn-cart-remove");

    if (btnRemover) {
      removerItem(btnRemover.dataset.key);
      return;
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.closest("#personalizacaoModal")) {
      atualizarResumoModalPersonalizacao();
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.closest("#personalizacaoModal")) {
      atualizarResumoModalPersonalizacao();
    }
  });

  const btnAdicionar = document.getElementById(
    "btnAdicionarProdutoCustomizado",
  );

  if (btnAdicionar) {
    btnAdicionar.addEventListener("click", () =>
      confirmarPersonalizacaoProduto(),
    );
  }

  const finalizarDesktop = document.getElementById("finalizarBtn");

  const finalizarMobile = document.getElementById("finalizarBtnMobile");

  if (finalizarDesktop && finalizarMobile) {
    const sincronizar = () => {
      finalizarMobile.disabled = finalizarDesktop.disabled;

      finalizarMobile.textContent = finalizarDesktop.textContent;

      finalizarMobile.title = finalizarDesktop.title || "";
    };

    sincronizar();

    new MutationObserver(sincronizar).observe(finalizarDesktop, {
      attributes: true,
      attributeFilter: ["disabled", "title"],
    });

    new MutationObserver(sincronizar).observe(finalizarDesktop, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}
