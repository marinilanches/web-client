import { addItemCustomizado } from "./cart.js";
import { listarAdicionais } from "../services/additionals.js";

let adicionaisGlobaisCache = [];
let adicionaisCarregados = false;

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escaparHtml(texto = "") {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function garantirAdicionaisGlobais() {
  if (adicionaisCarregados) return adicionaisGlobaisCache;

  try {
    const lista = await listarAdicionais();
    adicionaisGlobaisCache = Array.isArray(lista)
      ? lista.filter((item) => item?.ativo !== false)
      : [];
    adicionaisCarregados = true;
  } catch (error) {
    console.error("Erro ao carregar adicionais globais:", error);
    adicionaisGlobaisCache = [];
    adicionaisCarregados = true;
  }

  return adicionaisGlobaisCache;
}

function produtoTemPersonalizacao() {
  return adicionaisGlobaisCache.length > 0;
}

function criarModalBase() {
  let overlay = document.getElementById("customizationModal");

  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "customizationModal";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,.5)";
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";
  overlay.style.padding = "16px";

  overlay.innerHTML = `
    <div id="customizationModalCard" style="
      width:100%;
      max-width:680px;
      max-height:90vh;
      overflow:auto;
      background:#fff;
      border-radius:16px;
      padding:20px;
      box-shadow:0 20px 60px rgba(0,0,0,.25);
      position:relative;
    "></div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      fecharModalPersonalizacao();
    }
  });

  return overlay;
}

export function fecharModalPersonalizacao() {
  const overlay = document.getElementById("customizationModal");
  if (overlay) overlay.style.display = "none";
}

function calcularAcrescimo(adicionaisSelecionados) {
  return adicionaisSelecionados.reduce((total, item) => {
    return total + Number(item.preco || 0);
  }, 0);
}

function montarResumoPersonalizacao(adicionaisSelecionados) {
  if (!adicionaisSelecionados.length) return [];

  return [
    {
      tipo: "ADICIONAIS",
      itens: adicionaisSelecionados.map((item) => ({
        id: item.id,
        nome: item.nome,
        preco: Number(item.preco || 0)
      }))
    }
  ];
}

export async function abrirPersonalizacaoProduto(produto) {
  await garantirAdicionaisGlobais();

  const adicionais = adicionaisGlobaisCache.filter((item) => item?.ativo !== false);

  const overlay = criarModalBase();
  const card = document.getElementById("customizationModalCard");

  card.innerHTML = `
    <button
      id="btnFecharCustomizacao"
      type="button"
      style="
        position:absolute;
        top:12px;
        right:12px;
        border:none;
        background:#f3f3f3;
        border-radius:999px;
        width:36px;
        height:36px;
        cursor:pointer;
        font-size:18px;
      "
    >✕</button>

    <div style="padding-right:44px;">
      <h2 style="margin:0 0 6px 0;">${escaparHtml(produto.nome || "Produto")}</h2>
      <p style="margin:0 0 16px 0;color:#666;">
        ${escaparHtml(produto.descricao || "Personalize seu pedido")}
      </p>

      <div style="margin-bottom:16px;">
        <strong>Preço base:</strong> ${formatarMoeda(produto.preco || 0)}
      </div>

      <form id="formPersonalizacao">
        ${
          adicionais.length ? `
            <section style="margin-bottom:20px;padding:14px;border:1px solid #eee;border-radius:12px;">
              <div style="margin-bottom:10px;">
                <h3 style="margin:0 0 4px 0;font-size:16px;">Adicionais</h3>
                <small style="color:#666;">Escolha os adicionais desejados</small>
              </div>

              <div style="display:flex;flex-direction:column;gap:10px;">
                ${adicionais.map((item) => `
                  <label style="display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid #f0f0f0;padding:10px;border-radius:10px;">
                    <span style="display:flex;gap:10px;align-items:center;">
                      <input
                        type="checkbox"
                        name="adicionais"
                        value="${item.id}"
                        data-nome="${escaparHtml(item.nome)}"
                        data-preco="${Number(item.preco || 0)}"
                      />
                      <span>${escaparHtml(item.nome)}</span>
                    </span>
                    <strong>${Number(item.preco || 0) > 0 ? `+ ${formatarMoeda(item.preco)}` : "Grátis"}</strong>
                  </label>
                `).join("")}
              </div>
            </section>
          ` : `
            <section style="margin-bottom:20px;padding:14px;border:1px solid #eee;border-radius:12px;">
              <h3 style="margin:0 0 8px 0;font-size:16px;">Adicionais</h3>
              <p style="margin:0;color:#666;">Nenhum adicional disponível no momento.</p>
            </section>
          `
        }

        <section style="margin-bottom:20px;padding:14px;border:1px solid #eee;border-radius:12px;">
          <h3 style="margin:0 0 10px 0;font-size:16px;">Observação do item</h3>
          <textarea
            id="observacaoItem"
            placeholder="Ex.: sem cebola, maionese à parte..."
            style="width:100%;min-height:90px;padding:12px;border:1px solid #ddd;border-radius:10px;resize:vertical;"
          ></textarea>
        </section>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px;">
          <div>
            <div style="font-size:13px;color:#666;">Total deste item</div>
            <div id="totalItemCustomizacao" style="font-size:22px;font-weight:700;">
              ${formatarMoeda(produto.preco || 0)}
            </div>
          </div>

          <button
            type="submit"
            style="
              border:none;
              background:#dc3545;
              color:#fff;
              padding:14px 18px;
              border-radius:12px;
              cursor:pointer;
              font-weight:700;
            "
          >
            Adicionar ao carrinho
          </button>
        </div>
      </form>
    </div>
  `;

  overlay.style.display = "flex";

  const btnFechar = document.getElementById("btnFecharCustomizacao");
  const form = document.getElementById("formPersonalizacao");
  const totalItemEl = document.getElementById("totalItemCustomizacao");

  btnFechar?.addEventListener("click", fecharModalPersonalizacao);

  function coletarSelecoes() {
    const adicionaisSelecionados = Array.from(
      form.querySelectorAll('input[name="adicionais"]:checked')
    ).map((input) => ({
      id: input.value,
      nome: input.dataset.nome || "",
      preco: Number(input.dataset.preco || 0)
    }));

    return { adicionaisSelecionados };
  }

  function atualizarTotal() {
    const { adicionaisSelecionados } = coletarSelecoes();
    const acrescimo = calcularAcrescimo(adicionaisSelecionados);
    totalItemEl.textContent = formatarMoeda(Number(produto.preco || 0) + acrescimo);
  }

  form.addEventListener("change", atualizarTotal);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const { adicionaisSelecionados } = coletarSelecoes();

    const acrescimoAdicionais = adicionaisSelecionados.reduce((acc, item) => {
      return acc + Number(item.preco || 0);
    }, 0);

    const valorUnitario = Number(produto.preco || 0) + acrescimoAdicionais;

    const itemCarrinho = {
        id: `${produto.id}_${Date.now()}`,

        produtoId: produto.id,

        nome: produto.nome || "Produto",

        imagem: produto.imagem || "",

        quantidade: 1,

        precoBase: Number(produto.preco || 0),

        valorUnitario: Number(valorUnitario),

        adicionais: adicionaisSelecionados.map((item) => ({
            id: item.id,
            nome: item.nome,
            preco: Number(item.preco || 0)
        })),

        personalizacoes: montarResumoPersonalizacao(
            adicionaisSelecionados
        ),

        gruposPersonalizacaoSelecionados: [],

        observacaoItem:
            document.getElementById("observacaoItem")
            ?.value
            ?.trim() || ""
    };

    addItemCustomizado({
        produtoId: itemCarrinho.produtoId,
        nome: itemCarrinho.nome,
        valorBase: itemCarrinho.precoBase,
        valorAdicionais: itemCarrinho.valorUnitario - itemCarrinho.precoBase,
        valorUnitario: itemCarrinho.valorUnitario,
        imagem: itemCarrinho.imagem,
        observacao: itemCarrinho.observacaoItem,
        personalizacao: itemCarrinho.personalizacoes
    });

    fecharModalPersonalizacao();
  });

  atualizarTotal();
}

export function prepararAcaoAdicionarProduto() {
  document.addEventListener("click", async (event) => {
    const botao = event.target.closest(".btnAdd");
    if (!botao) return;

    const payload = botao.dataset.produto;
    if (!payload) return;

    let produto = null;

    try {
      produto = JSON.parse(decodeURIComponent(payload));
    } catch (erro) {
      console.error("Erro ao ler produto para personalização:", erro);
      return;
    }

    await garantirAdicionaisGlobais();

    if (!produtoTemPersonalizacao()) {
      adicionarAoCarrinho({
        id: `${produto.id}_${Date.now()}`,
        produtoId: produto.id,
        nome: produto.nome || "Produto",
        imagem: produto.imagem || "",
        quantidade: 1,
        precoBase: Number(produto.preco || 0),
        valorUnitario: Number(produto.preco || 0),
        adicionais: [],
        personalizacoes: [],
        gruposPersonalizacaoSelecionados: [],
        observacaoItem: ""
      });
      return;
    }

    abrirPersonalizacaoProduto(produto);
  });
}

export function getAdicionaisGlobais() {
  return adicionaisGlobaisCache.filter(
    (item) => item?.ativo !== false
  );
}