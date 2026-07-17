import { buscarPromocoes } from "../services/promocoes.js";
import { buscarProduto } from "../services/products.js";

const container = document.getElementById("promocoes");

export async function carregarPromocoes() {
  if (!container) return;

  try {
    const promocoesBase = await buscarPromocoes();

    const promocoes = await Promise.all(
      promocoesBase.map(async (promo) => {
        const produto = await buscarProduto(promo.produtoId);

        return {
          ...promo,
          produto,
        };
      }),
    );

    window.promocoesTeste = promocoes;

    if (!promocoes.length) {
      container.innerHTML = "";
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


    <p class="text-secondary">
      ${promo.descricao || ""}
    </p>


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
