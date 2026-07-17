import {
  listarPromocoes,
  criarPromocao,
  atualizarPromocao,
  excluirPromocao,
  buscarProdutosDisponiveis,
} from "../../js/services/promocoes.js";

const lista = document.getElementById("listaPromocoes");

const btnNova = document.getElementById("novaPromocao");

const modalElement = document.getElementById("modalPromocao");

const modal = modalElement
  ? bootstrap.Modal.getOrCreateInstance(modalElement)
  : null;

console.log("modal encontrado:", modalElement);
console.log("modal classes:", modalElement?.className);
console.log("modal visível:", modalElement?.classList.contains("show"));

const selectProduto = document.getElementById("produtoPromocao");

const previewProduto = document.getElementById("produtoPreview");

const precoPromocional = document.getElementById("precoPromocional");

const ativo = document.getElementById("ativoPromocao");

const diaSemana = document.getElementById("diaSemanaPromocao");

const mesPromocao = document.getElementById("mesPromocao");

const pagamento = document.getElementById("pagamentoPromocao");

const salvar = document.getElementById("salvarPromocao");

const promocaoId = document.getElementById("promocaoId");

let promocoes = [];

let produtos = [];

/* ==========================================================
CARREGAR
========================================================== */

async function carregar() {
  try {
    promocoes = await listarPromocoes();

    produtos = await buscarProdutosDisponiveis();

    carregarSelectProdutos();

    const mesAtual = new Date().getMonth() + 1;

    mesPromocao.value = new Date(2000, mesAtual - 1).toLocaleString("pt-BR", {
      month: "long",
    });

    mesPromocao.dataset.numero = mesAtual;

    renderizar();
  } catch (error) {
    console.error("Erro ao carregar promoções:", error);
  }
}

/* ==========================================================
SELECT PRODUTOS
========================================================== */

function carregarSelectProdutos() {
  if (!selectProduto) return;

  const produtosSemBebidas = produtos
    .filter((produto) => {
      const categoria = (produto.categoria || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      return !categoria.includes("bebida");
    })
    .sort((a, b) =>
      (a.nome || "").localeCompare(b.nome || "", "pt-BR", {
        sensitivity: "base",
      }),
    );

  selectProduto.innerHTML = `

<option value="">
Selecione um produto
</option>

${produtosSemBebidas
      .map(
        (produto) => `

<option value="${produto.id}">
${produto.nome}
</option>

`,
      )
      .join("")}

`;
}

/* ==========================================================
PREVIEW PRODUTO
========================================================== */

selectProduto?.addEventListener("change", () => {
  const produto = produtos.find((p) => p.id === selectProduto.value);

  if (!produto) {
    previewProduto.innerHTML = "";
    return;
  }

  previewProduto.innerHTML = `

<div class="card border-0 shadow-sm rounded-4">

<div class="card-body">


${produto.imagem
      ? `
<img
src="${produto.imagem}"
style="
width:100%;
height:160px;
object-fit:cover;
border-radius:15px;
margin-bottom:15px;
"
>
`
      : ""
    }



<h5 class="fw-bold">
${produto.nome}
</h5>


<p class="text-secondary">
${produto.descricao || ""}
</p>


<strong>
Preço atual:
R$ ${Number(produto.preco || 0).toFixed(2)}
</strong>


</div>

</div>

`;
});

/* ==========================================================
RENDER
========================================================== */

function renderizar() {
  if (!lista) return;

  if (!promocoes.length) {
    lista.innerHTML = `

<div class="panel">

<p>
Nenhuma promoção cadastrada.
</p>

</div>

`;

    return;
  }

  lista.innerHTML = promocoes
    .map(
      (promo) => `


<div class="panel">


<div class="panel-title">

🔥 ${promo.titulo}

</div>



${promo.imagem
          ? `

<img
src="${promo.imagem}"
style="
width:100%;
max-height:220px;
object-fit:cover;
border-radius:16px;
margin-bottom:15px;
"
>

`
          : ""
        }



<p>
${promo.descricao || ""}
</p>



<p>

<strong>
R$ ${Number(promo.precoOriginal || 0).toFixed(2)}
</strong>


→


<strong style="color:#ea1d2c">

R$ ${Number(promo.precoPromocional || 0).toFixed(2)}

</strong>


</p>



<p>

Status:

${promo.ativo ? "🟢 Ativa" : "🔴 Inativa"}

</p>



<div class="toolbar">


<button
onclick="editarPromocao('${promo.id}')"
>
✏️ Editar
</button>



<button
onclick="alternarPromocao('${promo.id}', ${promo.ativo})"
>

${promo.ativo ? "Desativar" : "Ativar"}

</button>



<button
class="btn-danger"
onclick="removerPromocao('${promo.id}')"
>

🗑 Excluir

</button>


</div>



</div>


`,
    )
    .join("");
}

/* ==========================================================
NOVA PROMOÇÃO
========================================================== */

btnNova?.addEventListener("click", () => {

  console.log("CLIQUE NOVA PROMOÇÃO");
  promocaoId.value = "";

  selectProduto.value = "";

  previewProduto.innerHTML = "";

  precoPromocional.value = "";

  diaSemana.value = "";
  pagamento.value = "";
  const mesAtual = new Date().getMonth() + 1;

  mesPromocao.value = new Date(2000, mesAtual - 1).toLocaleString("pt-BR", {
    month: "long",
  });

  mesPromocao.dataset.numero = mesAtual;

  ativo.checked = true;

  console.trace("ABRINDO MODAL PROMOCAO");

  modal?.show();
});

/* ==========================================================
SALVAR
========================================================== */

salvar?.addEventListener("click", async () => {
  const produto = produtos.find((p) => p.id === selectProduto.value);

  if (!produto) {
    alert("Selecione um produto.");

    return;
  }

  const dados = {
    produtoId: produto.id,

    titulo: produto.nome,

    descricao: produto.descricao || "",

    imagem: produto.imagem || "",

    precoOriginal: Number(produto.preco || 0),

    precoPromocional: Number(precoPromocional.value || 0),

    ativo: ativo.checked,

    regras: {
      diasSemana: diaSemana.value ? [diaSemana.value] : [],

      meses: [Number(mesPromocao.dataset.numero)],

      pagamentos: pagamento.value ? [pagamento.value] : [],
    },
  };

  try {
    if (promocaoId.value) {
      await atualizarPromocao(promocaoId.value, dados);
    } else {
      await criarPromocao(dados);
    }

    modal?.hide();

    carregar();
  } catch (error) {
    console.error("Erro ao salvar promoção:", error);
  }
});

/* ==========================================================
EDITAR
========================================================== */

window.editarPromocao = async function (id) {
  const promo = promocoes.find((p) => p.id === id);

  if (!promo) return;

  promocaoId.value = promo.id;

  selectProduto.value = promo.produtoId;

  precoPromocional.value = promo.precoPromocional;

  diaSemana.value = promo.regras?.diasSemana?.[0] || "";

  pagamento.value = promo.regras?.pagamentos?.[0] || "";

  const numeroMes = promo.regras?.meses?.[0] ?? new Date().getMonth() + 1;

  mesPromocao.value = new Date(2000, numeroMes - 1).toLocaleString("pt-BR", {
    month: "long",
  });

  mesPromocao.dataset.numero = numeroMes;

  ativo.checked = promo.ativo;

  selectProduto.dispatchEvent(new Event("change"));

  modal?.show();
};

/* ==========================================================
ATIVAR
========================================================== */

window.alternarPromocao = async function (id, status) {
  await atualizarPromocao(id, {
    ativo: !status,
  });

  carregar();
};

/* ==========================================================
EXCLUIR
========================================================== */

window.removerPromocao = async function (id) {
  if (!confirm("Excluir esta promoção?")) return;

  await excluirPromocao(id);

  carregar();
};

carregar();
