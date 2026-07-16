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

export function atualizarCarrinho() {
  updateUI();
}

/* ==========================================================
   EVENTOS
========================================================== */

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function escaparHtml(texto = "") {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function iniciarEventosCarrinho() {
  document.addEventListener("click", async (e) => {
    const btnAdd = e.target.closest(".btnAdd");

    if (btnAdd) {
      try {
        const produtoRaw = btnAdd.dataset.produto;

        if (!produtoRaw) return;

        const produto = JSON.parse(decodeURIComponent(produtoRaw));

        await carregarAdicionaisGlobais();

        if (produtoTemPersonalizacao(produto)) {
          abrirModalPersonalizacao(produto);
        } else {
          addItem(
            produto.id,
            produto.nome,
            Number(produto.preco || 0),
            produto.imagem || "",
            produto.promocao || false,
            produto.regrasPromocao || {},
            Number(produto.precoOriginal || 0),
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
    const btnEditar = e.target.closest(".btn-cart-edit");

    if (btnEditar) {
      editarItemCarrinho(btnEditar.dataset.key);
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
    function sincronizarFinalizacao() {
      finalizarMobile.disabled = finalizarDesktop.disabled;

      finalizarMobile.textContent = finalizarDesktop.textContent;

      finalizarMobile.title = finalizarDesktop.title || "";
    }

    sincronizarFinalizacao();

    new MutationObserver(sincronizarFinalizacao).observe(finalizarDesktop, {
      attributes: true,
      attributeFilter: ["disabled", "title"],
    });

    new MutationObserver(sincronizarFinalizacao).observe(finalizarDesktop, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

async function carregarAdicionaisGlobais() {
  console.log(adicionaisGlobaisCache);

  if (adicionaisGlobaisCarregados) {
    return;
  }

  try {
    adicionaisGlobaisCache = (await listarAdicionais()).filter(
      (item) => item?.ativo !== false,
    );

    adicionaisGlobaisCarregados = true;
  } catch (erro) {
    console.error("Erro ao carregar adicionais globais:", erro);

    adicionaisGlobaisCache = [];
  }
}

function produtoTemPersonalizacao(produto = {}) {
  // bebidas nunca abrem adicionais
  if (produtoEhBebida(produto)) {
    return false;
  }

  const possuiGrupos =
    Array.isArray(produto.gruposPersonalizacao) &&
    produto.gruposPersonalizacao.length > 0;

  const possuiAdicionaisProduto =
    Array.isArray(produto.adicionais) && produto.adicionais.length > 0;

  const possuiAdicionaisGlobais =
    Array.isArray(adicionaisGlobaisCache) && adicionaisGlobaisCache.length > 0;

  return possuiGrupos || possuiAdicionaisProduto || possuiAdicionaisGlobais;
}

let produtoPersonalizandoAtual = null;

let itemEditandoKey = null;

function produtoEhBebida(produto = {}) {
  const categoria =
    produto.categoria?.nome || produto.categoria || produto.grupo || "";

  return categoria
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .includes("bebida");
}

const adicionaisRenderizados = new Map();

function abrirModalPersonalizacao(produto) {
  produtoPersonalizandoAtual = produto;

  document.getElementById("personalizacaoTitulo").textContent =
    produto.nome || "Personalizar produto";

  document.getElementById("personalizacaoProdutoNome").textContent =
    produto.nome || "";

  document.getElementById("personalizacaoProdutoDescricao").textContent =
    produto.descricao || "";

  document.getElementById("personalizacaoPrecoBase").textContent =
    `Valor base: ${formatarMoeda(produto.preco || 0)}`;

  document.getElementById("personalizacaoTotal").textContent = formatarMoeda(
    produto.preco || 0,
  );

  const observacao = document.getElementById("personalizacaoObservacao");

  if (observacao) {
    observacao.value = "";
  }

  montarGruposDoProduto(produto);

  const modalElement = document.getElementById("personalizacaoModal");

  if (!modalElement) {
    console.error("Modal #personalizacaoModal não encontrado.");

    return;
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

  modal.show();
}

function montarGruposDoProduto(produto = {}) {
  if (produtoEhBebida(produto)) {
    renderizarGruposNoModal([]);
    return;
  }

  const grupos = [];
  const ids = new Set();

  function adicionarGrupo(grupo) {
    if (!grupo) return;

    const chave = grupo.id ?? grupo.nome ?? grupo.name;

    if (!chave || ids.has(chave)) {
      return;
    }

    ids.add(chave);
    grupos.push(grupo);
  }

  /*
   * 1. Grupos específicos
   */

  if (Array.isArray(produto.gruposPersonalizacao)) {
    produto.gruposPersonalizacao.forEach(adicionarGrupo);
  }

  /*
   * 2. Adicionais específicos
   */

  if (Array.isArray(produto.adicionais) && produto.adicionais.length) {
    adicionarGrupo({
      id: "__produto",

      nome: "Adicionais",

      adicionais: produto.adicionais,
    });
  }

  /*
   * 3. Adicionais globais
   */

  if (adicionaisGlobaisCache.length) {
    adicionarGrupo({
      id: "__globais",

      nome: "Outros adicionais",

      adicionais: adicionaisGlobaisCache,
    });
  }

  console.log("Grupos:", grupos);

  renderizarGruposNoModal(grupos);
}
function renderizarGruposNoModal(grupos = []) {
  const container = document.getElementById("personalizacaoGrupos");

  if (!container) {
    console.error("Container #personalizacaoGrupos não encontrado.");
    return;
  }

  container.innerHTML = "";
  adicionaisRenderizados.clear();

  grupos.forEach((grupo) => {
    const bloco = document.createElement("div");
    bloco.className = "mb-4";

    const titulo = document.createElement("h6");
    titulo.className = "fw-bold mb-3";
    titulo.textContent = grupo.nome || grupo.name || "Opções";

    bloco.appendChild(titulo);

    const adicionais = grupo.itens || grupo.adicionais || [];

    adicionais.forEach((adicional) => {
      const chave = `${grupo.id}:${adicional.id}`;

      adicionaisRenderizados.set(chave, adicional);

      const wrapper = document.createElement("label");

      wrapper.className = "form-check mb-2";

      const input = document.createElement("input");

      input.type = "checkbox";
      input.className = "form-check-input adicional-checkbox";
      input.dataset.id = chave;

      const texto = document.createElement("span");

      texto.className = "form-check-label ms-2";

      texto.textContent = `${adicional.nome || adicional.name || ""}
         ${
           Number(adicional.preco || 0) > 0
             ? `(+ ${formatarMoeda(adicional.preco)})`
             : "(Grátis)"
         }`;

      wrapper.appendChild(input);
      wrapper.appendChild(texto);

      bloco.appendChild(wrapper);
    });

    container.appendChild(bloco);
  });

  atualizarResumoModalPersonalizacao();
}

function atualizarResumoModalPersonalizacao() {
  if (!produtoPersonalizandoAtual) {
    return;
  }

  const adicionaisSelecionados = Array.from(
    document.querySelectorAll(
      "#personalizacaoModal .adicional-checkbox:checked",
    ),
  )
    .map((checkbox) => adicionaisRenderizados.get(checkbox.dataset.id))
    .filter(Boolean);

  const valorAdicionais = adicionaisSelecionados.reduce(
    (total, adicional) => total + Number(adicional.preco || 0),
    0,
  );

  const total = Number(produtoPersonalizandoAtual.preco || 0) + valorAdicionais;

  const totalEl = document.getElementById("personalizacaoTotal");

  if (totalEl) {
    totalEl.textContent = formatarMoeda(total);
  }
}

function confirmarPersonalizacaoProduto() {
  if (!produtoPersonalizandoAtual) {
    console.error("Nenhum produto em personalização.");

    return;
  }

  console.log(
    "Selecionados:",
    Array.from(document.querySelectorAll(".adicional-checkbox:checked")).map(
      (cb) => ({
        id: cb.dataset.id,
        adicional: adicionaisRenderizados.get(cb.dataset.id),
      }),
    ),
  );

  const selecionados = Array.from(
    document.querySelectorAll(
      "#personalizacaoModal .adicional-checkbox:checked",
    ),
  )
    .map((checkbox) => ({
      ...adicionaisRenderizados.get(checkbox.dataset.id),
      __key: checkbox.dataset.id,
    }))
    .filter(Boolean);

  const observacao =
    document.getElementById("personalizacaoObservacao")?.value ?? "";

  if (itemEditandoKey) {
    atualizarItemEditado(itemEditandoKey, selecionados, observacao);

    itemEditandoKey = null;
  } else {
    addItemCustomizado(produtoPersonalizandoAtual, selecionados, observacao);
  }

  const modalElement = document.getElementById("personalizacaoModal");

  if (modalElement) {
    const modal = bootstrap.Modal.getInstance(modalElement);

    modal?.hide();

    const observacao = document.getElementById("personalizacaoObservacao");

    if (observacao) {
      observacao.value = "";
    }

    adicionaisRenderizados.clear();

    const grupos = document.getElementById("personalizacaoGrupos");

    if (grupos) {
      grupos.innerHTML = "";
    }
  }

  produtoPersonalizandoAtual = null;

  abrirCarrinhoNoMobile();
}
function editarItemCarrinho(key) {
  const item = carrinho.find((produto) => produto.key === key);

  if (!item) {
    console.error("Item não encontrado:", key);
    return;
  }

  itemEditandoKey = key;

  produtoPersonalizandoAtual = {
    ...item,

    preco: item.precoBase ?? item.valorUnitario,

    gruposPersonalizacao: item.gruposPersonalizacao || [],

    adicionais: item.adicionaisDisponiveis || [],
  };

  document.getElementById("personalizacaoTitulo").textContent = item.nome;

  document.getElementById("personalizacaoProdutoNome").textContent = item.nome;

  document.getElementById("personalizacaoPrecoBase").textContent =
    `Valor base: ${formatarMoeda(produtoPersonalizandoAtual.preco)}`;

  document.getElementById("personalizacaoObservacao").value =
    item.personalizados?.observacao || "";

  montarGruposDoProduto({
    ...produtoPersonalizandoAtual,

    adicionais: item.adicionaisDisponiveis || [],
  });

  setTimeout(() => {
    const adicionaisAtuais = item.personalizados?.adicionais || [];

    document
      .querySelectorAll("#personalizacaoModal .adicional-checkbox")
      .forEach((check) => {
        const adicional = adicionaisRenderizados.get(check.dataset.id);

        if (adicionaisAtuais.some((a) => a.id === adicional?.id)) {
          check.checked = true;
        }
      });

    atualizarResumoModalPersonalizacao();
  }, 50);

  const modalElement = document.getElementById("personalizacaoModal");

  bootstrap.Modal.getOrCreateInstance(modalElement).show();
}
function atualizarItemEditado(key, adicionais = [], observacao = "") {
  const item = carrinho.find((i) => i.key === key);

  if (!item) return;

  const valorAdicionais = adicionais.reduce(
    (total, a) => total + Number(a.preco || 0),
    0,
  );

  const precoBase = Number(
    item.precoBase ?? item.valorUnitario - (item.valorAdicionais || 0),
  );

  item.valorAdicionais = valorAdicionais;

  item.valorUnitario = precoBase + valorAdicionais;

  item.preco = item.valorUnitario;

  item.personalizados = {
    adicionais,

    observacao: (observacao || "").trim(),
  };

  salvarCarrinho();

  updateUI();
}

function addItemCustomizado(produto, adicionais = [], observacao = "") {
  const precoBase = Number(produto.preco || 0);

  const valorAdicionais = adicionais.reduce(
    (total, adicional) => total + Number(adicional.preco || 0),
    0,
  );

  const observacaoNormalizada = (observacao || "").trim();

  const key = gerarChaveItemPersonalizado(
    produto,
    adicionais,
    observacaoNormalizada,
  );

  const item = {
    ...produto,

    id: produto.id,
    nome: produto.nome,

    preco: produto.precoPromocional ?? produto.precoBase ?? produto.preco,

    precoBase: produto.precoPromocional ?? produto.precoBase ?? produto.preco,

    quantidade: 1,

    promocao: produto.promocao ?? false,

    precoOriginal: produto.precoOriginal ?? null,

    precoPromocional: produto.precoPromocional ?? null,
  };

  const existente = carrinho.find(
    (itemCarrinho) => itemCarrinho.key === item.key,
  );

  if (existente) {
    existente.quantidade++;
  } else {
    carrinho.push(item);
  }

  salvarCarrinho();

  updateUI();
}

function gerarChaveItemPersonalizado(produto, adicionais, observacao) {
  const obs = (observacao || "").trim();

  const adicionaisKey = adicionais
    .map((a) => a.__key || a.id)
    .sort()
    .join("|");

  return `${produto.id}::${adicionaisKey}::${obs}`;
}

/* ==========================================================
   CARRINHO
========================================================== */

function addItem(
  id,
  nome,
  preco,
  imagem = "",
  promocao = false,
  regrasPromocao = {},
  precoOriginal = 0,
) {
  const key = String(id);

  const existente = carrinho.find((item) => item.key === key);

  if (existente) {
    existente.quantidade++;
  } else {
    carrinho.push({
      key,

      id,

      nome,

      preco,

      precoOriginal,

      precoPromocional: preco,

      valorUnitario: preco,

      imagem,

      promocao,

      regrasPromocao,

      quantidade: 1,

      personalizados: {
        adicionais: [],
        observacao: "",
      },
    });
  }

  salvarCarrinho();
  updateUI();
}

function aumentarQuantidade(key) {
  const item = carrinho.find((item) => item.key === key);

  if (!item) return;

  item.quantidade++;

  salvarCarrinho();
  updateUI();
}

function diminuirQuantidade(key) {
  const item = carrinho.find((item) => item.key === key);

  if (!item) return;

  item.quantidade--;

  if (item.quantidade <= 0) {
    carrinho = carrinho.filter((i) => i.key !== key);
  }

  salvarCarrinho();
  updateUI();
}

function removerItem(key) {
  carrinho = carrinho.filter((item) => item.key !== key);

  salvarCarrinho();
  updateUI();
}

function salvarCarrinho() {
  localStorage.setItem("mesaFacilCarrinho", JSON.stringify(carrinho));
}

function carregarCarrinho() {
  try {
    carrinho = JSON.parse(localStorage.getItem("mesaFacilCarrinho")) || [];
  } catch {
    carrinho = [];
  }

  carrinho = carrinho.map((item) => ({
    ...item,

    gruposPersonalizacao: item.gruposPersonalizacao || [],

    adicionaisDisponiveis: item.adicionaisDisponiveis || [],

    valorUnitario: item.valorUnitario ?? item.preco,

    personalizados: {
      adicionais: item.personalizados?.adicionais || [],

      observacao: item.personalizados?.observacao || "",
    },
  }));
}

/* ==========================================================
   RENDER
========================================================== */

function updateUI() {
  quantidade = 0;
  total = 0;

  carrinho.forEach((item) => {
    quantidade += item.quantidade;

    total += obterPrecoAtual(item) * item.quantidade;
  });

  atualizarResumo();

  renderCarrinhoDesktop();

  renderCarrinhoMobile();
}

function obterPrecoAtual(item) {
  if (!item.promocao) {
    return Number(item.valorUnitario ?? item.preco);
  }

  const formaPagamento =
    document.querySelector('input[name="pagamento"]:checked')?.value || "";

  const pagamentosPermitidos = item.regrasPromocao?.pagamentos || [];

  if (
    pagamentosPermitidos.length &&
    !pagamentosPermitidos.includes(formaPagamento)
  ) {
    return Number(item.precoOriginal || item.preco);
  }

  return Number(item.preco);
}

function atualizarResumo() {
  const valor = formatarMoeda(total);

  ["qtd", "qtdCarrinho", "qtdCarrinhoMobile", "qtdCarrinhoOffcanvas"].forEach(
    (id) => {
      const el = document.getElementById(id);

      if (el) {
        el.textContent = quantidade;
      }
    },
  );

  [
    "total",
    "totalCarrinho",
    "totalCarrinhoMobile",
    "totalCarrinhoOffcanvas",
  ].forEach((id) => {
    const el = document.getElementById(id);

    if (el) {
      el.textContent = valor;
    }
  });
}

function renderCarrinhoDesktop() {
  const container = document.getElementById("cartItems");

  if (!container) return;

  renderCarrinho(container);
}

function renderCarrinhoMobile() {
  const container = document.getElementById("cartItemsMobile");

  if (!container) return;

  renderCarrinho(container);
}

function renderCarrinho(container) {
  if (!carrinho.length) {
    container.innerHTML = `

    <div class="cart-empty">

    <div class="cart-empty-icon">

        <i class="bi bi-bag"></i>

    </div>

    <h4 class="mb-2">

        Seu carrinho está vazio

    </h4>

    <p class="mb-0 text-secondary">

        Adicione itens do cardápio para continuar.

    </p>

</div>

    `;

    return;
  }

  container.innerHTML = carrinho.map(renderItemCarrinho).join("");
}

function renderItemCarrinho(item) {
  const adicionais = item.personalizados?.adicionais || [];

  const htmlAdicionais = adicionais.length
    ? `
      <div class="small text-secondary mt-1">

        ${adicionais.map((a) => `+ ${escaparHtml(a.nome)}`).join("<br>")}

      </div>
    `
    : "";

  const htmlObs = item.personalizados?.observacao
    ? `
      <div class="small fst-italic mt-1">

        Obs:
        ${escaparHtml(item.personalizados?.observacao || "")}

      </div>
    `
    : "";

  return `

  <div class="card mb-2">

    <div class="card-body">

      <div class="d-flex justify-content-between">

        <strong>

          ${escaparHtml(item.nome)}

        </strong>

        <strong>

          ${formatarMoeda((item.valorUnitario ?? item.preco) * item.quantidade)}

        </strong>

      </div>

      ${htmlAdicionais}

      ${htmlObs}

      <div class="mt-2 d-flex align-items-center gap-2">

        <button
          class="btn btn-sm btn-outline-secondary btn-cart-minus"
          data-key="${item.key}"
        >

          -

        </button>

        <span>

          ${item.quantidade}

        </span>

        <button
          class="btn btn-sm btn-outline-secondary btn-cart-plus"
          data-key="${item.key}"
        >

          +

        </button>

        <button
          class="btn btn-sm btn-outline-primary btn-cart-edit"
          data-key="${item.key}"
        >
          Editar
        </button>

        <button
          class="btn btn-sm btn-outline-danger ms-auto btn-cart-remove"
          data-key="${item.key}"
        >
          Remover
        </button>

      </div>

    </div>

  </div>

  `;
}

/* ==========================================================
   AUXILIARES
========================================================== */

function sincronizarTipoPedido() {
  // reservado para integração futura
}

function abrirCarrinhoNoMobile() {
  const offcanvas = document.getElementById("cartOffcanvas");

  if (!offcanvas) return;

  bootstrap.Offcanvas.getOrCreateInstance(offcanvas).show();
}
