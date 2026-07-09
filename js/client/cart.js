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
  sincronizarTipoPedido();
  iniciarEventosCarrinho();
  updateUI();
}

function iniciarEventosCarrinho() {
  document.addEventListener("click", (e) => {
    const btnAdd = e.target.closest(".btnAdd");
    if (btnAdd) {
      addItem(
        btnAdd.dataset.id,
        btnAdd.dataset.nome,
        Number(btnAdd.dataset.preco),
        btnAdd.dataset.imagem || ""
      );

      abrirCarrinhoNoMobile();
      return;
    }

    const btnMais = e.target.closest(".btn-cart-plus");
    if (btnMais) {
      aumentarQuantidade(btnMais.dataset.nome);
      return;
    }

    const btnMenos = e.target.closest(".btn-cart-minus");
    if (btnMenos) {
      diminuirQuantidade(btnMenos.dataset.nome);
      return;
    }

    const btnRemover = e.target.closest(".btn-cart-remove");
    if (btnRemover) {
      removerItem(btnRemover.dataset.nome);
      return;
    }
  });

  const finalizarDesktop = document.getElementById("finalizarBtn");
  const finalizarMobile = document.getElementById("finalizarBtnMobile");

  if (finalizarDesktop && finalizarMobile) {
    const syncDisabled = () => {
      finalizarMobile.disabled = finalizarDesktop.disabled;
      finalizarMobile.textContent = finalizarDesktop.textContent;
      finalizarMobile.title = finalizarDesktop.title || "";
    };

    syncDisabled();

    const observer = new MutationObserver(syncDisabled);
    observer.observe(finalizarDesktop, {
      attributes: true,
      attributeFilter: ["disabled", "title"]
    });

    // também sincroniza quando o texto mudar
    const textObserver = new MutationObserver(syncDisabled);
    textObserver.observe(finalizarDesktop, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
}

/* ==========================================================
   ADICIONAR ITEM
========================================================== */

export function addItem(produtoId, nome, preco, imagem = "") {
  const id = String(produtoId || "").trim();
  if (!id) {
    console.warn("Produto sem ID ao adicionar no carrinho:", {
      produtoId,
      nome,
      preco
    });
    return;
  }

  const item = carrinho.find((produto) => produto.produtoId === id);

  if (item) {
    item.quantidade++;
  } else {
    carrinho.push({
      id,                 // compatibilidade
      produtoId: id,      // campo oficial do carrinho
      nome,
      quantidade: 1,
      valorUnitario: Number(preco || 0),
      preco: Number(preco || 0), // compatibilidade com outras partes
      imagem: imagem || ""
    });
  }

  recalcular();
}

/* ==========================================================
   REMOVER ITEM
========================================================== */

export function removerItem(nome) {
  carrinho = carrinho.filter((item) => item.nome !== nome);
  recalcular();
}

/* ==========================================================
   AUMENTAR QUANTIDADE
========================================================== */

export function aumentarQuantidade(nome) {
  const item = carrinho.find((produto) => produto.nome === nome);
  if (!item) return;

  item.quantidade++;
  recalcular();
}

/* ==========================================================
   DIMINUIR QUANTIDADE
========================================================== */

export function diminuirQuantidade(nome) {
  const item = carrinho.find((produto) => produto.nome === nome);
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

  carrinho.forEach((item) => {
    quantidade += item.quantidade;
    total += item.quantidade * item.valorUnitario;
  });

  updateUI();
  salvarCarrinho();
}

/* ==========================================================
   HELPERS
========================================================== */

function formatarMoeda(valor) {
  return Number(valor || 0).toFixed(2);
}

function escaparHtml(texto = "") {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTipoPedidoAtual() {
  return localStorage.getItem("tipoPedido") || "Delivery";
}

function salvarTipoPedido(valor) {
  localStorage.setItem("tipoPedido", valor || "Delivery");
}

function sincronizarTipoPedido() {
  if (!localStorage.getItem("tipoPedido")) {
    localStorage.setItem("tipoPedido", "Delivery");
  }
}

/* ==========================================================
   RENDER DO CARRINHO
========================================================== */

function getCartItemMarkup(item) {
  const subtotal = item.quantidade * item.valorUnitario;
  const nomeEscapado = escaparHtml(item.nome);

  return `
    <div class="cart-item-card">
      <div class="cart-item-top">
        <div class="flex-grow-1">
          <h4 class="cart-item-title">${nomeEscapado}</h4>
          <p class="cart-item-unit">R$ ${formatarMoeda(item.valorUnitario)} cada</p>
        </div>

        <button
          class="btn-cart-remove"
          data-nome="${nomeEscapado}"
          type="button"
          aria-label="Remover item"
        >
          <i class="bi bi-trash3"></i>
        </button>
      </div>

      <div class="cart-item-bottom">
        <div class="cart-qty">
          <button
            class="btn-cart-minus"
            data-nome="${nomeEscapado}"
            type="button"
            aria-label="Diminuir quantidade"
          >
            −
          </button>

          <span class="cart-qty-value">${item.quantidade}</span>

          <button
            class="btn-cart-plus"
            data-nome="${nomeEscapado}"
            type="button"
            aria-label="Aumentar quantidade"
          >
            +
          </button>
        </div>

        <strong class="cart-item-price">R$ ${formatarMoeda(subtotal)}</strong>
      </div>
    </div>
  `;
}

function getEmptyMarkup() {
  return `
    <div class="cart-empty">
      <div class="cart-empty-icon">
        <i class="bi bi-bag"></i>
      </div>
      <h4 class="mb-2">Seu carrinho está vazio</h4>
      <p class="mb-0 text-secondary">
        Adicione itens do cardápio para continuar.
      </p>
    </div>
  `;
}

function renderCarrinho() {
  const cartItemsDesktop = document.getElementById("cartItems");
  const cartItemsMobile = document.getElementById("cartItemsMobile");

  const html = !carrinho.length
    ? getEmptyMarkup()
    : carrinho.map(getCartItemMarkup).join("");

  if (cartItemsDesktop) cartItemsDesktop.innerHTML = html;
  if (cartItemsMobile) cartItemsMobile.innerHTML = html;
}

/* ==========================================================
   ATUALIZAR UI
========================================================== */

export function updateUI() {
  const qtdEls = [
    document.getElementById("qtd"),
    document.getElementById("qtdCarrinho"),
    document.getElementById("qtdCarrinhoOffcanvas"),
    document.getElementById("qtdCarrinhoMobile")
  ].filter(Boolean);

  const totalEls = [
    document.getElementById("total"),
    document.getElementById("totalCarrinho"),
    document.getElementById("totalCarrinhoOffcanvas"),
    document.getElementById("totalCarrinhoMobile")
  ].filter(Boolean);

  qtdEls.forEach((el) => {
    el.innerText = quantidade;
  });

  totalEls.forEach((el) => {
    el.innerText = formatarMoeda(total);
  });

  // garante que exista um tipo salvo mesmo sem mexer no select
  salvarTipoPedido(getTipoPedidoAtual());

  renderCarrinho();
}

/* ==========================================================
   MOBILE OFFCANVAS
========================================================== */

function abrirCarrinhoNoMobile() {
  const offcanvasEl = document.getElementById("cartOffcanvas");
  if (!offcanvasEl) return;

  if (window.innerWidth >= 1200) return;

  if (window.bootstrap?.Offcanvas) {
    const instance = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
    instance.show();
  }
}

/* ==========================================================
   LOCAL STORAGE
========================================================== */

function salvarCarrinho() {
  localStorage.setItem("carrinho", JSON.stringify(carrinho));
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