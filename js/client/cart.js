import {
  buscarAdicional,
  listarAdicionais
} from "../services/additionals.js";

import { getAdicionaisGlobais } from "./customization.js";

console.log(
  "ADICIONAIS NO CART:",
  getAdicionaisGlobais()
);

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
  garantirModalPersonalizacao();
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

        const produto = JSON.parse(
          decodeURIComponent(produtoRaw)
        );


        await carregarAdicionaisGlobais();


        const temPersonalizacao = produtoTemPersonalizacao(produto);

        console.log(
          "Produto:",
          produto
        );

        console.log(
          "Tem personalização?",
          temPersonalizacao
        );


        if (temPersonalizacao) {

          console.log(
            "Abrindo modal de personalização..."
          );

          await abrirFluxoPersonalizacaoProduto(produto);

          return;
        }

        addItem(
          produto.id,
          produto.nome,
          Number(produto.preco || 0),
          produto.imagem || ""
        );

        abrirCarrinhoNoMobile();
      } catch (erro) {
        console.error("Erro ao ler produto do botão:", erro);
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

    const btnFecharModal = e.target.closest("[data-cart-modal-close]");
    if (btnFecharModal) {
      fecharModalPersonalizacao();
      return;
    }

    const btnBackdrop = e.target.closest("#cartPersonalizacaoModal");
    if (btnBackdrop && e.target.id === "cartPersonalizacaoModal") {
      fecharModalPersonalizacao();
      return;
    }
  });

  document.addEventListener("change", (e) => {
    if (!e.target.closest("#cartPersonalizacaoForm")) return;
    atualizarResumoModalPersonalizacao();
  });

  document.addEventListener("input", (e) => {
    if (!e.target.closest("#cartPersonalizacaoForm")) return;
    atualizarResumoModalPersonalizacao();
  });

  document.addEventListener("submit", (e) => {
    if (e.target?.id === "cartPersonalizacaoForm") {
      e.preventDefault();
      confirmarPersonalizacaoProduto();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      fecharModalPersonalizacao();
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

    const textObserver = new MutationObserver(syncDisabled);
    textObserver.observe(finalizarDesktop, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
}

/* ==========================================================
   HELPERS DE PERSONALIZAÇÃO
========================================================== */

function produtoTemPersonalizacao(produto = {}) {

  const temAdicionaisGlobais =
    adicionaisGlobaisCache.length > 0;

  const temGrupoAdicional = !!produto.grupoAdicionalId;

  const temGruposPersonalizacao =
    Array.isArray(produto.gruposPersonalizacao) &&
    produto.gruposPersonalizacao.some(
      (grupo) =>
        Array.isArray(grupo?.opcoes) &&
        grupo.opcoes.some(
          (opcao) => opcao?.ativo !== false
        )
    );

  const temAdicionais =
    Array.isArray(produto.adicionais) &&
    produto.adicionais.some(
      (item) => item?.ativo !== false
    );

  return (
    temGrupoAdicional ||
    temGruposPersonalizacao ||
    temAdicionais ||
    temAdicionaisGlobais
  );
}

async function abrirFluxoPersonalizacaoProduto(produto) {

  if (adicionaisGlobaisCache.length) {

    abrirModalPersonalizacao({
      ...produto,
      adicionais: adicionaisGlobaisCache
    });

    return;
  }

  // Compatibilidade com modelo antigo baseado em grupoAdicionalId
  if (produto.grupoAdicionalId) {
    await abrirModalPersonalizacaoProduto(produto);
    return;
  }

  // fallback
  addItem(
    produto.id,
    produto.nome,
    Number(produto.preco || 0),
    produto.imagem || ""
  );
  abrirCarrinhoNoMobile();
}

function gerarKeyItem({ produtoId, personalizacao = [], observacao = "" }) {
  return JSON.stringify({
    produtoId: String(produtoId || ""),
    personalizacao,
    observacao: String(observacao || "").trim()
  });
}

function normalizarPersonalizacao(personalizacao = []) {
  return (Array.isArray(personalizacao) ? personalizacao : []).map((grupo) => ({
    grupoId: grupo.grupoId || "",
    grupoNome: grupo.grupoNome || "",
    opcoes: (Array.isArray(grupo.opcoes) ? grupo.opcoes : []).map((opcao) => ({
      id: opcao.id || "",
      nome: opcao.nome || "",
      preco: Number(opcao.preco || 0)
    }))
  }));
}

function calcularValorAdicionais(personalizacao = []) {
  return normalizarPersonalizacao(personalizacao).reduce((acc, grupo) => {
    return acc + grupo.opcoes.reduce((sum, opcao) => {
      return sum + Number(opcao.preco || 0);
    }, 0);
  }, 0);
}

async function carregarAdicionaisGlobais() {

  console.log(
    "CACHE FINAL:",
    adicionaisGlobaisCache
  );

  if (adicionaisGlobaisCarregados) {
    return adicionaisGlobaisCache;
  }

  try {

    const lista = await listarAdicionais();

    adicionaisGlobaisCache = Array.isArray(lista)
      ? lista.filter(item => item.ativo !== false)
      : [];

    adicionaisGlobaisCarregados = true;

    console.log(
      "Adicionais carregados:",
      adicionaisGlobaisCache
    );

  } catch (erro) {

    console.error(
      "Erro ao carregar adicionais:",
      erro
    );

    adicionaisGlobaisCache = [];
    adicionaisGlobaisCarregados = true;
  }


  return adicionaisGlobaisCache;
}

/* ==========================================================
   AÇÕES DO CARRINHO
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

  const key = gerarKeyItem({
    produtoId: id,
    personalizacao: [],
    observacao: ""
  });

  const item = carrinho.find((produto) => produto.key === key);

  if (item) {
    item.quantidade++;
  } else {
    carrinho.push({
      key,
      id,
      produtoId: id,
      nome,
      quantidade: 1,
      valorBase: Number(preco || 0),
      valorAdicionais: 0,
      valorUnitario: Number(preco || 0),
      preco: Number(preco || 0),
      imagem: imagem || "",
      observacao: "",
      personalizacao: []
    });
  }

  recalcular();
}

export function addItemCustomizado({
  produtoId,
  nome,
  valorBase,
  valorAdicionais,
  valorUnitario,
  imagem = "",
  observacao = "",
  personalizacao = []
}) {
  const id = String(produtoId || "").trim();

  if (!id) {
    console.warn("Produto customizado sem ID.");
    return;
  }

  const personalizacaoNormalizada = normalizarPersonalizacao(personalizacao);

  const adicionaisCalculados = Number(
    valorAdicionais ?? calcularValorAdicionais(personalizacaoNormalizada)
  );

  const unitario = Number(
    valorUnitario ?? (Number(valorBase || 0) + adicionaisCalculados)
  );

  const key = gerarKeyItem({
    produtoId: id,
    personalizacao: personalizacaoNormalizada,
    observacao
  });

  const item = carrinho.find((produto) => produto.key === key);

  if (item) {
    item.quantidade++;
  } else {
    carrinho.push({
      key,
      id,
      produtoId: id,
      nome,
      quantidade: 1,
      valorBase: Number(valorBase || 0),
      valorAdicionais: adicionaisCalculados,
      valorUnitario: unitario,
      preco: unitario,
      imagem: imagem || "",
      observacao: observacao || "",
      personalizacao: personalizacaoNormalizada
    });
  }

  recalcular();
  abrirCarrinhoNoMobile();
}

export function aumentarQuantidade(key) {
  const item = carrinho.find((produto) => produto.key === key);
  if (!item) return;

  item.quantidade++;
  recalcular();
}

export function diminuirQuantidade(key) {
  const item = carrinho.find((produto) => produto.key === key);
  if (!item) return;

  item.quantidade--;

  if (item.quantidade <= 0) {
    removerItem(key);
    return;
  }

  recalcular();
}

export function removerItem(key) {
  carrinho = carrinho.filter((item) => item.key !== key);
  recalcular();
}

export function limparCarrinho() {
  carrinho = [];
  quantidade = 0;
  total = 0;
  localStorage.removeItem("carrinho");
  updateUI();
}

/* ==========================================================
   CÁLCULOS / STORAGE
========================================================== */

function recalcular() {
  quantidade = 0;
  total = 0;

  carrinho.forEach((item) => {
    quantidade += Number(item.quantidade || 0);
    total += Number(item.quantidade || 0) * Number(item.valorUnitario || 0);
  });

  updateUI();
  salvarCarrinho();
}

function salvarCarrinho() {
  localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function carregarCarrinho() {
  const salvo = localStorage.getItem("carrinho");
  if (!salvo) return;

  try {
    carrinho = JSON.parse(salvo) || [];
  } catch {
    carrinho = [];
  }

  recalcular();
}

function sincronizarTipoPedido() {
  if (!localStorage.getItem("tipoPedido")) {
    localStorage.setItem("tipoPedido", "Delivery");
  }
}

function salvarTipoPedido(valor) {
  localStorage.setItem("tipoPedido", valor || "Delivery");
}

function getTipoPedidoAtual() {
  return localStorage.getItem("tipoPedido") || "Delivery";
}

/* ==========================================================
   RENDER DO CARRINHO
========================================================== */

function renderCarrinho() {
  const cartItemsDesktop = document.getElementById("cartItems");
  const cartItemsMobile = document.getElementById("cartItemsMobile");

  const html = !carrinho.length
    ? getEmptyMarkup()
    : carrinho.map(getCartItemMarkup).join("");

  if (cartItemsDesktop) cartItemsDesktop.innerHTML = html;
  if (cartItemsMobile) cartItemsMobile.innerHTML = html;
}

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

  salvarTipoPedido(getTipoPedidoAtual());
  renderCarrinho();
}

function getPersonalizacaoMarkup(item) {
  const grupos = Array.isArray(item.personalizacao) ? item.personalizacao : [];
  const observacao = String(item.observacao || "").trim();

  if (!grupos.length && !observacao) return "";

  const gruposHtml = grupos
    .map((grupo) => {
      const opcoes = Array.isArray(grupo.opcoes) ? grupo.opcoes : [];
      if (!opcoes.length) return "";

      return `
        <div class="cart-item-extra-line">
          <span class="fw-semibold">${escaparHtml(grupo.grupoNome)}:</span>
          ${opcoes.map((op) => escaparHtml(op.nome)).join(", ")}
        </div>
      `;
    })
    .join("");

  const observacaoHtml = observacao
    ? `
      <div class="cart-item-extra-line">
        <span class="fw-semibold">Obs:</span> ${escaparHtml(observacao)}
      </div>
    `
    : "";

  return `
    <div class="cart-item-extras mt-2">
      ${gruposHtml}
      ${observacaoHtml}
    </div>
  `;
}

function getCartItemMarkup(item) {
  const subtotal = Number(item.quantidade || 0) * Number(item.valorUnitario || 0);
  const keyEscapada = escaparHtml(item.key);

  return `
    <div class="cart-item-card">
      <div class="cart-item-top">
        <div class="flex-grow-1">
          <h4 class="cart-item-title">${escaparHtml(item.nome)}</h4>
          <p class="cart-item-unit">R$ ${formatarMoeda(item.valorUnitario)} cada</p>
          ${getPersonalizacaoMarkup(item)}
        </div>

        <button
          class="btn-cart-remove"
          data-key="${keyEscapada}"
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
            data-key="${keyEscapada}"
            type="button"
            aria-label="Diminuir quantidade"
          >
            −
          </button>

          <span class="cart-qty-value">${item.quantidade}</span>

          <button
            class="btn-cart-plus"
            data-key="${keyEscapada}"
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

/* ==========================================================
   MODAL DE PERSONALIZAÇÃO (PADRÃO DO CARRINHO)
========================================================== */

function abrirModalPersonalizacao(produto) {
  console.log(">>> entrou em abrirModalPersonalizacao");

  garantirModalPersonalizacao();

  console.log(
    "Modal existe?",
    document.getElementById("cartPersonalizacaoModal")
  );

  const modal = document.getElementById("cartPersonalizacaoModal");
  const nomeEl = document.getElementById("cartModalProdutoNome");
  const precoEl = document.getElementById("cartModalProdutoPreco");
  const gruposEl = document.getElementById("cartModalGrupos");
  const observacaoEl = document.getElementById("cartModalObservacao");
  const form = document.getElementById("cartPersonalizacaoForm");

  console.log({
    modal,
    nomeEl,
    precoEl,
    gruposEl,
    observacaoEl,
    form
  });

  if (!modal || !nomeEl || !precoEl || !gruposEl || !observacaoEl || !form) {
    console.error("Elementos faltando no modal", {
      modal,
      nomeEl,
      precoEl,
      gruposEl,
      observacaoEl,
      form
    });
    return;
  }

  const grupos = montarGruposDoProduto(produto);

  form.dataset.produto = encodeURIComponent(JSON.stringify({
    id: produto.id,
    nome: produto.nome || "",
    preco: Number(produto.preco || 0),
    imagem: produto.imagem || "",
    grupos
  }));

  nomeEl.textContent = produto.nome || "Personalizar produto";
  precoEl.textContent = `Valor base: R$ ${formatarMoeda(produto.preco || 0)}`;
  observacaoEl.value = "";

  gruposEl.innerHTML = grupos.map((grupo) => {
    const inputType = getInputTypeByGrupo(grupo);
    const obrigatorio = grupo.obrigatorio || Number(grupo.minSelecao || 0) > 0;

    return `
      <section
        class="cart-modal-group"
        data-grupo-id="${escaparHtml(grupo.id)}"
        data-grupo-nome="${escaparHtml(grupo.nome)}"
        data-grupo-tipo="${escaparHtml(grupo.tipo)}"
        data-grupo-obrigatorio="${obrigatorio ? "1" : "0"}"
        data-grupo-min="${Number(grupo.minSelecao || 0)}"
        data-grupo-max="${Number(grupo.maxSelecao || 0)}"
      >
        <div class="cart-modal-group-header">
          <div>
            <h4 class="cart-modal-section-title mb-1">
              ${escaparHtml(grupo.nome)}
            </h4>
            <p class="cart-modal-group-hint">
              ${escaparHtml(getGrupoHint(grupo))}
            </p>
          </div>

          ${obrigatorio ? `<span class="cart-modal-required">Obrigatório</span>` : ""}
        </div>

        <div class="cart-modal-options">
          ${grupo.opcoes.map((opcao) => `
            <label class="cart-modal-option">
              <input
                type="${inputType}"
                name="grupo_${escaparHtml(grupo.id)}${inputType === "checkbox" ? "[]" : ""}"
                value="${escaparHtml(opcao.id)}"
                data-opcao-id="${escaparHtml(opcao.id)}"
                data-opcao-nome="${escaparHtml(opcao.nome)}"
                data-opcao-preco="${Number(opcao.preco || 0)}"
              >

              <div class="cart-modal-option-main">
                <span class="cart-modal-option-name">
                  ${escaparHtml(opcao.nome)}
                </span>

                <span class="cart-modal-option-price">
                  ${Number(opcao.preco || 0) > 0 ? `+ R$ ${formatarMoeda(opcao.preco)}` : "Grátis"}
                </span>
              </div>
            </label>
          `).join("")}
        </div>

        <div class="cart-modal-error" data-grupo-error style="display:none;"></div>
      </section>
    `;
  }).join("");

  console.log("ANTES DE ABRIR MODAL");

  modal.classList.add("is-open");
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";

  console.log("DEPOIS DE ABRIR MODAL", modal);

  atualizarResumoModalPersonalizacao();
}

function confirmarPersonalizacaoProduto() {
  const form = document.getElementById("cartPersonalizacaoForm");
  const observacaoEl = document.getElementById("cartModalObservacao");

  if (!form) return;

  const produtoRaw = form.dataset.produto;
  if (!produtoRaw) return;

  let produto;
  try {
    produto = JSON.parse(decodeURIComponent(produtoRaw));
  } catch (erro) {
    console.error("Erro ao ler produto do modal:", erro);
    return;
  }

  const personalizacao = coletarPersonalizacaoDoModal(true);
  if (personalizacao === null) return;

  const observacao = observacaoEl?.value?.trim() || "";
  const valorBase = Number(produto.preco || 0);
  const valorAdicionais = calcularValorAdicionais(personalizacao);
  const valorUnitario = valorBase + valorAdicionais;

  addItemCustomizado({
    produtoId: produto.id,
    nome: produto.nome,
    valorBase,
    valorAdicionais,
    valorUnitario,
    imagem: produto.imagem || "",
    observacao,
    personalizacao
  });

  fecharModalPersonalizacao();
}

function coletarPersonalizacaoDoModal(validar = true) {
  const form = document.getElementById("cartPersonalizacaoForm");
  if (!form) return [];

  const gruposEls = [...form.querySelectorAll("[data-grupo-id]")];
  const personalizacao = [];
  let possuiErro = false;

  gruposEls.forEach((grupoEl) => {
    const grupoId = grupoEl.dataset.grupoId || "";
    const grupoNome = grupoEl.dataset.grupoNome || "";
    const grupoTipo = grupoEl.dataset.grupoTipo || "RADIO";
    const obrigatorio = grupoEl.dataset.grupoObrigatorio === "1";
    const minSelecao = Number(grupoEl.dataset.grupoMin || 0);
    const maxSelecao = Number(grupoEl.dataset.grupoMax || 0);

    const inputs = [...grupoEl.querySelectorAll("input[type='radio'], input[type='checkbox']")];
    const selecionados = inputs.filter((input) => input.checked);

    const errorEl = grupoEl.querySelector("[data-grupo-error]");

    if (errorEl) {
      errorEl.style.display = "none";
      errorEl.textContent = "";
    }

    if (validar) {
      if (obrigatorio && selecionados.length < Math.max(1, minSelecao)) {
        possuiErro = true;
        if (errorEl) {
          errorEl.textContent = minSelecao > 1
            ? `Selecione pelo menos ${minSelecao} opções em "${grupoNome}".`
            : `Selecione uma opção em "${grupoNome}".`;
          errorEl.style.display = "block";
        }
      }

      if (grupoTipo === "CHECKBOX" && maxSelecao > 0 && selecionados.length > maxSelecao) {
        possuiErro = true;
        if (errorEl) {
          errorEl.textContent = `Selecione no máximo ${maxSelecao} opções em "${grupoNome}".`;
          errorEl.style.display = "block";
        }
      }
    }

    if (!selecionados.length) return;

    personalizacao.push({
      grupoId,
      grupoNome,
      opcoes: selecionados.map((input) => ({
        id: input.dataset.opcaoId || input.value || "",
        nome: input.dataset.opcaoNome || "",
        preco: Number(input.dataset.opcaoPreco || 0)
      }))
    });
  });

  if (possuiErro && validar) {
    return null;
  }

  return personalizacao;
}

function atualizarResumoModalPersonalizacao() {
  const totalEl = document.getElementById("cartModalTotal");
  const form = document.getElementById("cartPersonalizacaoForm");
  if (!totalEl || !form?.dataset.produto) return;

  let produto;
  try {
    produto = JSON.parse(decodeURIComponent(form.dataset.produto));
  } catch {
    return;
  }

  const personalizacao = coletarPersonalizacaoDoModal(false);
  const totalItem = Number(produto.preco || 0) + calcularValorAdicionais(personalizacao);

  totalEl.textContent = `R$ ${formatarMoeda(totalItem)}`;
}

function montarGruposDoProduto(produto = {}) {
    const grupos = [];

    const adicionaisAtivos = [
        ...(Array.isArray(produto.adicionais)
            ? produto.adicionais
            : []),
        ...adicionaisGlobaisCache
    ]
    .filter((item, index, array) =>
        item?.ativo !== false &&
        array.findIndex(x => x.id === item.id) === index
    )
    .map(item => ({
        id: item.id,
        nome: item.nome,
        preco: Number(item.preco || 0),
        ativo: true
    }));

    if (adicionaisAtivos.length) {
        grupos.push({
            id: "adicionais",
            nome: "Adicionais",
            obrigatorio: false,
            minSelecao: 0,
            maxSelecao: adicionaisAtivos.length,
            tipo: "CHECKBOX",
            opcoes: adicionaisAtivos
        });
    }

    return grupos;
}

function garantirModalPersonalizacao() {
  if (document.getElementById("cartPersonalizacaoModal")) return;

  const modal = document.createElement("div");
  modal.id = "cartPersonalizacaoModal";
  modal.className = "cart-modal-overlay";
  modal.style.display = "none";

  modal.innerHTML = `
    <div class="cart-modal-dialog">
      <div class="cart-modal-header">
        <div>
          <h3 id="cartModalProdutoNome" class="cart-modal-title">Personalizar produto</h3>
          <p id="cartModalProdutoPreco" class="cart-modal-subtitle mb-0"></p>
        </div>

        <button
          type="button"
          class="cart-modal-close"
          data-cart-modal-close
          aria-label="Fechar"
        >
          ×
        </button>
      </div>

      <form id="cartPersonalizacaoForm" class="cart-modal-body">
        <div id="cartModalGrupos"></div>

        <div class="cart-modal-observacao">
          <label for="cartModalObservacao" class="cart-modal-section-title">
            Observações do pedido
          </label>
          <textarea
            id="cartModalObservacao"
            rows="3"
            placeholder="Ex.: sem cebola, molho separado..."
          ></textarea>
        </div>

        <div class="cart-modal-footer">
          <div class="cart-modal-total-wrap">
            <span>Total do item</span>
            <strong id="cartModalTotal">R$ 0,00</strong>
          </div>

          <div class="cart-modal-actions">
            <button
              type="button"
              class="btn btn-secondary"
              data-cart-modal-close
            >
              Cancelar
            </button>

            <button
              type="submit"
              class="btn btn-danger"
            >
              Adicionar ao carrinho
            </button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  injetarCssModalPersonalizacao();
}

function fecharModalPersonalizacao() {
  const modal = document.getElementById("cartPersonalizacaoModal");
  const form = document.getElementById("cartPersonalizacaoForm");

  if (form) {
    form.reset();
    delete form.dataset.produto;
  }

  if (modal) {
    modal.classList.remove("is-open");
    modal.style.display = "none";
  }

  document.body.style.overflow = "";
}

/* ==========================================================
   MODAL LEGADO VIA grupoAdicionalId
========================================================== */

async function abrirModalPersonalizacaoProduto(produto) {
  const grupo = await buscarAdicional(produto.grupoAdicionalId);

  if (!grupo || grupo.ativo === false) {
    addItem(produto.id, produto.nome, Number(produto.preco || 0), produto.imagem || "");
    abrirCarrinhoNoMobile();
    return;
  }

  const opcoes = Array.isArray(grupo.opcoes)
    ? grupo.opcoes.filter((op) => op?.ativo !== false)
    : [];

  const modal = document.getElementById("productCustomizationModal");
  if (!modal) {
    // se o modal legado não existir, usa o modal novo do carrinho
    abrirModalPersonalizacao({
      ...produto,
      adicionais: adicionaisGlobaisCache
    });
    return;
  }

  const title = modal.querySelector("[data-custom-title]");
  const base = modal.querySelector("[data-custom-base]");
  const totalEl = modal.querySelector("[data-custom-total]");
  const optionsWrap = modal.querySelector("[data-custom-options]");
  const obsEl = modal.querySelector("[data-custom-obs]");
  const btnConfirm = modal.querySelector("[data-custom-confirm]");

  if (title) title.textContent = produto.nome || "Produto";
  if (base) base.textContent = `R$ ${formatarMoeda(produto.preco || 0)}`;
  if (obsEl) obsEl.value = "";

  optionsWrap.innerHTML = opcoes.length
    ? opcoes.map((op) => `
        <label class="custom-option">
          <input
            type="checkbox"
            value="${escaparHtml(op.id)}"
            data-nome="${escaparHtml(op.nome)}"
            data-preco="${Number(op.preco || 0)}"
          >
          <span>${escaparHtml(op.nome)}</span>
          <strong>+ R$ ${formatarMoeda(op.preco || 0)}</strong>
        </label>
      `).join("")
    : `<p class="text-secondary mb-0">Nenhum adicional disponível.</p>`;

  function recalcularModal() {
    const checks = [...optionsWrap.querySelectorAll("input[type='checkbox']:checked")];
    const adicionais = checks.reduce((acc, input) => {
      return acc + Number(input.dataset.preco || 0);
    }, 0);

    const totalItem = Number(produto.preco || 0) + adicionais;
    if (totalEl) totalEl.textContent = `R$ ${formatarMoeda(totalItem)}`;
  }

  optionsWrap.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", recalcularModal);
  });

  recalcularModal();

  const bsModal = bootstrap.Modal.getOrCreateInstance(modal);
  bsModal.show();

  const novoBotao = btnConfirm.cloneNode(true);
  btnConfirm.parentNode.replaceChild(novoBotao, btnConfirm);

  novoBotao.addEventListener("click", () => {
    const checks = [...optionsWrap.querySelectorAll("input[type='checkbox']:checked")];

    const opcoesSelecionadas = checks.map((input) => ({
      id: input.value,
      nome: input.dataset.nome || "",
      preco: Number(input.dataset.preco || 0)
    }));

    const personalizacao = opcoesSelecionadas.length
      ? [
          {
            grupoId: grupo.id,
            grupoNome: grupo.nome || "Adicionais",
            opcoes: opcoesSelecionadas
          }
        ]
      : [];

    const valorAdicionais = opcoesSelecionadas.reduce((acc, op) => acc + Number(op.preco || 0), 0);

    addItemCustomizado({
      produtoId: produto.id,
      nome: produto.nome,
      valorBase: Number(produto.preco || 0),
      valorAdicionais,
      valorUnitario: Number(produto.preco || 0) + valorAdicionais,
      imagem: produto.imagem || "",
      observacao: obsEl?.value?.trim() || "",
      personalizacao
    });

    bsModal.hide();
  });
}

/* ==========================================================
   UTILITÁRIOS
========================================================== */

function normalizarGrupoPersonalizacao(grupo = {}) {
  const tipoOriginal = String(grupo.tipo || "RADIO").toUpperCase();
  const opcoesAtivas = (Array.isArray(grupo.opcoes) ? grupo.opcoes : [])
    .filter((opcao) => opcao?.ativo !== false)
    .map((opcao) => ({
      id: opcao.id || crypto.randomUUID(),
      nome: opcao.nome || "",
      preco: Number(opcao.preco || 0),
      ativo: opcao.ativo ?? true
    }));

  if (!opcoesAtivas.length) return null;

  const tipo = tipoOriginal === "CHECKBOX" ? "CHECKBOX" : "RADIO";
  const maxPadrao = tipo === "CHECKBOX" ? opcoesAtivas.length : 1;

  return {
    id: grupo.id || crypto.randomUUID(),
    nome: grupo.nome || "Personalização",
    obrigatorio: grupo.obrigatorio ?? false,
    minSelecao: Number(grupo.minSelecao ?? (grupo.obrigatorio ? 1 : 0)),
    maxSelecao: Number(grupo.maxSelecao ?? maxPadrao),
    tipo,
    opcoes: opcoesAtivas
  };
}

function getInputTypeByGrupo(grupo) {
  return grupo.tipo === "CHECKBOX" ? "checkbox" : "radio";
}

function getGrupoHint(grupo) {
  if (grupo.tipo === "RADIO") {
    return grupo.obrigatorio ? "Escolha 1 opção obrigatória" : "Escolha 1 opção";
  }

  const min = Number(grupo.minSelecao || 0);
  const max = Number(grupo.maxSelecao || 0);

  if (grupo.obrigatorio && min > 0 && max > 0) {
    return `Escolha de ${min} até ${max} opções`;
  }

  if (grupo.obrigatorio && min > 0) {
    return `Escolha pelo menos ${min} opção(ões)`;
  }

  if (max > 0) {
    return `Escolha até ${max} opção(ões)`;
  }

  return "Escolha quantas opções quiser";
}

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

function abrirCarrinhoNoMobile() {
  const offcanvasEl = document.getElementById("cartOffcanvas");
  if (!offcanvasEl) return;

  if (window.innerWidth >= 1200) return;

  if (window.bootstrap?.Offcanvas) {
    const instance = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
    instance.show();
  }
}

function injetarCssModalPersonalizacao() {
  if (document.getElementById("cartPersonalizacaoModalStyle")) return;

  const style = document.createElement("style");
  style.id = "cartPersonalizacaoModalStyle";
  style.textContent = `
    .cart-modal-overlay{
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.45);
      z-index:9999;
      display:none;
      align-items:center;
      justify-content:center;
      padding:16px;
    }

    .cart-modal-overlay.is-open{
      display:flex !important;
    }

    .cart-modal-dialog{
      width:min(760px, 100%);
      max-height:90vh;
      overflow:auto;
      background:#fff;
      border-radius:20px;
      box-shadow:0 20px 60px rgba(0,0,0,.2);
    }

    .cart-modal-header{
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      padding:20px 20px 12px;
      border-bottom:1px solid #eee;
    }

    .cart-modal-title{
      margin:0;
      font-size:1.2rem;
      font-weight:700;
    }

    .cart-modal-subtitle{
      color:#666;
      margin-top:6px;
      font-size:.95rem;
    }

    .cart-modal-close{
      border:none;
      background:transparent;
      font-size:1.8rem;
      line-height:1;
      cursor:pointer;
    }

    .cart-modal-body{
      padding:20px;
    }

    .cart-modal-group{
      border:1px solid #eee;
      border-radius:16px;
      padding:16px;
      margin-bottom:16px;
    }

    .cart-modal-group-header{
      display:flex;
      justify-content:space-between;
      gap:12px;
      margin-bottom:12px;
      flex-wrap:wrap;
    }

    .cart-modal-section-title{
      display:block;
      margin:0 0 4px;
      font-size:1rem;
      font-weight:700;
    }

    .cart-modal-group-hint{
      margin:0;
      color:#666;
      font-size:.92rem;
    }

    .cart-modal-required{
      color:#dc3545;
      font-weight:600;
      font-size:.92rem;
    }

    .cart-modal-options{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .cart-modal-option{
      display:flex;
      align-items:flex-start;
      gap:12px;
      padding:12px;
      border:1px solid #eee;
      border-radius:14px;
      cursor:pointer;
    }

    .cart-modal-option input{
      margin-top:3px;
    }

    .cart-modal-option-main{
      display:flex;
      justify-content:space-between;
      gap:12px;
      width:100%;
      align-items:flex-start;
    }

    .cart-modal-option-name{
      font-weight:500;
    }

    .cart-modal-option-price{
      white-space:nowrap;
      font-weight:600;
    }

    .cart-modal-observacao{
      margin-top:8px;
    }

    .cart-modal-observacao textarea{
      width:100%;
      border:1px solid #ddd;
      border-radius:14px;
      padding:12px 14px;
      resize:vertical;
      min-height:90px;
      outline:none;
    }

    .cart-modal-observacao textarea:focus{
      border-color:#999;
    }

    .cart-modal-footer{
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:center;
      margin-top:20px;
      flex-wrap:wrap;
    }

    .cart-modal-total-wrap{
      display:flex;
      flex-direction:column;
      gap:4px;
    }

    .cart-modal-total-wrap strong{
      font-size:1.15rem;
    }

    .cart-modal-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }

    .cart-modal-error{
      margin-top:10px;
      color:#dc3545;
      font-size:.92rem;
      font-weight:600;
    }

    @media (max-width: 640px){
      .cart-modal-dialog{
        max-height:95vh;
        border-radius:18px;
      }

      .cart-modal-body,
      .cart-modal-header{
        padding:16px;
      }

      .cart-modal-footer{
        flex-direction:column;
        align-items:stretch;
      }

      .cart-modal-actions{
        width:100%;
      }

      .cart-modal-actions .btn{
        flex:1;
      }
    }
  `;

  document.head.appendChild(style);
}