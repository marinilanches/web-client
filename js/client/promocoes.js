import { buscarPromocoes } from "../services/promocoes.js";
import { buscarProduto } from "../services/products.js";

const container = document.getElementById("promocoes");

function promocaoEstaValida(promo) {
  if (promo.ativo === false) {
    return false;
  }

  const regras = promo.regras || {};

  const diasPermitidos = regras.diasSemana || [];
  const mesesPermitidos = regras.meses || [];

  const hoje = new Date();

  const diaAtual = hoje
    .toLocaleDateString("pt-BR", {
      weekday: "long",
    })
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace("-feira", "");

  const mesAtual = hoje.getMonth() + 1;

  // Valida dia da semana
  if (
    diasPermitidos.length &&
    !diasPermitidos.includes(diaAtual)
  ) {
    return false;
  }

  // Valida mês
  if (
    mesesPermitidos.length &&
    !mesesPermitidos.includes(mesAtual)
  ) {
    return false;
  }

  return true;
}

function gerarDescricaoRegras(regras = {}) {
  const dias = regras.diasSemana || [];
  const meses = regras.meses || [];
  const pagamentos = regras.pagamentos || [];

  const nomesDias = {
    domingo: "domingos",
    segunda: "segundas-feiras",
    terca: "terças-feiras",
    quarta: "quartas-feiras",
    quinta: "quintas-feiras",
    sexta: "sextas-feiras",
    sabado: "sábados",
  };

  const nomesMeses = {
    1: "janeiro",
    2: "fevereiro",
    3: "março",
    4: "abril",
    5: "maio",
    6: "junho",
    7: "julho",
    8: "agosto",
    9: "setembro",
    10: "outubro",
    11: "novembro",
    12: "dezembro",
  };

  const partes = [];

  if (dias.length) {
    const textoDias = dias
      .map(
        (d) =>
          nomesDias[
            d
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace("-feira", "")
          ] || d,
      )
      .join(", ");

    partes.push(textoDias);
  }

  if (meses.length) {
    const textoMeses = meses.map((m) => nomesMeses[m] || m).join(", ");

    partes.push(`de ${textoMeses}`);
  }

  let texto = "";

  if (partes.length) {
    texto = `Válida para ${partes.join(" ")}.`;
  }

  if (pagamentos.length) {
    const lista = pagamentos
      .map((p) => {
        switch (p) {
          case "pix":
            return "PIX";
          case "dinheiro":
            return "Dinheiro";
          case "cartao":
            return "Cartão";
          default:
            return p;
        }
      })
      .join(" ou ");

    texto = texto.replace(/\.$/, "");
    texto += ` com pagamento no ${lista}.`;
  }

  return texto;
}

export async function carregarPromocoes() {
  if (!container) return;

  try {
    const promocoesValidas = (await buscarPromocoes()).filter(
      promocaoEstaValida
    );

    const promocoes = await Promise.all(
      promocoesValidas.map(async (promo) => {
        const produto = await buscarProduto(promo.produtoId);

        return {
          ...promo,
          produto,
        };
      }),
    );

    window.promocoesTeste = promocoes;

    if (!promocoes.length) {
      container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-light text-center">
            🔥 Nenhuma promoção disponível hoje.<br>
            As promoções funcionam de segunda a quinta.
          </div>
        </div>
      `;

      return;
    }

    promocoes.forEach((promo) => {
      console.log("PROMOÇÃO FIREBASE:", promo);
    });

    container.innerHTML = promocoes
      .map(
        (promo) => `

<div class="col-12 col-md-6 col-lg-4">

  <div class="promocao-card">

  ${
    promo.imagem
      ? `
    <img
      class="product-thumb"
      src="${promo.imagem}"
    >
    `
      : ""
  }


  <div class="p-3">

    <h5 class="fw-bold">
      ${promo.titulo || "Promoção"}
    </h5>


    <p class="text-secondary mb-1">
      ${promo.descricao || ""}
    </p>

    ${
      gerarDescricaoRegras(promo.regras)
        ? `
          <small class="text-muted d-block mb-3">
            <i class="bi bi-info-circle me-1"></i>
            ${gerarDescricaoRegras(promo.regras)}
          </small>
        `
        : ""
    }


    <div class="d-flex justify-content-between align-items-center">

      <strong class="preco-promocao">
        R$ ${Number(promo.precoPromocional).toFixed(2)}
      </strong>


      <button
        class="btn btn-danger btn-add-product btnAdd"
        data-produto="${encodeURIComponent(
          JSON.stringify({
            id: promo.produto.id,

            nome: promo.produto.nome,

            descricao: promo.produto.descricao,

            imagem: promo.produto.imagem,

            categoria: promo.produto.categoria,

            gruposPersonalizacao: promo.produto.gruposPersonalizacao || [],

            adicionais: promo.produto.adicionais || [],

            preco: Number(promo.precoPromocional || 0),

            precoBase: Number(promo.precoPromocional || 0),

            precoOriginal: Number(promo.precoOriginal || 0),

            promocao: true,

            precoPromocional: Number(promo.precoPromocional || 0),

            regrasPromocao: promo.regras || {},
          }),
        )}"
        type="button"
      >
        <i class="bi bi-plus-lg me-1"></i>
        Adicionar
      </button>

    </div>

  </div>

</div>

</div>

`,
      )
      .join("");
  } catch (error) {
    console.error("Erro ao carregar promoções:", error);
  }
}
