const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

let estado = {
  online: true,
  fila: 0,
  impressosHoje: 0,
  ultimaImpressao: null
};

function escapeHtml(valor = "") {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarMoeda(valor) {
  return Number(valor || 0).toFixed(2).replace(".", ",");
}

function montarItensHtml(itens = []) {
  if (!Array.isArray(itens) || itens.length === 0) {
    return `<p><strong>Itens:</strong> Nenhum item informado</p>`;
  }

  return `
    <div class="bloco">
      <div class="titulo">ITENS</div>
      ${itens.map((item) => {
        const nome = escapeHtml(item.nome || "Item");
        const quantidade = Number(item.quantidade || 1);
        const valor = Number(item.valorUnitario || item.preco || 0);

        const adicionais = Array.isArray(item.adicionais) && item.adicionais.length
          ? `
            <div class="subtexto">
              Adicionais: ${item.adicionais.map(a => escapeHtml(a.nome || a)).join(", ")}
            </div>
          `
          : "";

        return `
          <div class="item">
            <div>
              <strong>${quantidade}x ${nome}</strong>
              ${adicionais}
            </div>
            <div>R$ ${formatarMoeda(valor * quantidade)}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function gerarHtmlPedido(pedido) {
  const numero = pedido.numeroPedido || pedido.id || "-";
  const cliente = pedido.cliente || "Cliente sem nome";

  const telefone = pedido.telefone || "-";
  const telefoneWhatsapp = pedido.telefoneWhatsapp || "-";

  const tipo = pedido.tipo || "Delivery";
  const status = pedido.status || "RECEBIDO";

  const bairro = pedido.bairro || "-";
  const taxaEntrega = Number(pedido.taxaEntrega || 0);

  const endereco = pedido.endereco || "-";
  const referencia = pedido.referencia || "-";
  const observacoes = pedido.observacoes || "-";

  const pagamentoMetodo = pedido.pagamentoMetodo || "-";
  const pagamentoStatus = pedido.pagamentoStatus || "-";
  const trocoPara = pedido.trocoPara ? formatarMoeda(pedido.trocoPara) : null;

  const valorSubtotal = Number(pedido.valorSubtotal || 0);
  const valorTotal = Number(pedido.valorTotal || 0);

  const data = new Date().toLocaleString("pt-BR");

  const isDelivery = tipo === "Delivery";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Pedido ${escapeHtml(numero)}</title>
  <style>
    * {
      box-sizing: border-box;
      font-family: Arial, sans-serif;
    }

    body {
      margin: 0;
      padding: 18px;
      color: #000;
      background: #fff;
    }

    .cupom {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
      border: 2px dashed #000;
      padding: 18px;
    }

    .topo {
      text-align: center;
      margin-bottom: 14px;
    }

    .topo h1 {
      margin: 0 0 6px;
      font-size: 28px;
    }

    .topo p {
      margin: 4px 0;
      font-size: 14px;
    }

    .linha {
      border-top: 2px dashed #000;
      margin: 14px 0;
    }

    .bloco {
      margin-bottom: 14px;
    }

    .titulo {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
    }

    .item {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 8px;
      border-bottom: 1px dashed #999;
      padding-bottom: 8px;
    }

    .item:last-child {
      border-bottom: none;
    }

    .subtexto {
      font-size: 13px;
      color: #333;
      margin-top: 4px;
    }

    .total-box {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 2px dashed #000;
    }

    .total-linha {
      display: flex;
      justify-content: space-between;
      margin: 6px 0;
      font-size: 16px;
    }

    .total-geral {
      font-size: 24px;
      font-weight: bold;
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
    }

    .rodape {
      margin-top: 20px;
      text-align: center;
      font-size: 13px;
    }

    .destaque {
      font-weight: bold;
      font-size: 16px;
    }

    @media print {
      body {
        padding: 0;
      }

      .cupom {
        border: none;
        max-width: 100%;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="cupom">
    <div class="topo">
      <h1>MESA FÁCIL</h1>
      <p><strong>PEDIDO #${escapeHtml(numero)}</strong></p>
      <p>${escapeHtml(data)}</p>
      <p><strong>VIA ÚNICA - COZINHA / ENTREGA</strong></p>
    </div>

    <div class="linha"></div>

    <div class="bloco">
      <div class="titulo">DADOS DO PEDIDO</div>
      <div class="grid">
        <div><strong>Cliente:</strong> ${escapeHtml(cliente)}</div>
        <div><strong>Status:</strong> ${escapeHtml(status)}</div>

        <div><strong>Telefone:</strong> ${escapeHtml(telefone)}</div>
        <div><strong>WhatsApp:</strong> ${escapeHtml(telefoneWhatsapp)}</div>

        <div><strong>Tipo:</strong> ${escapeHtml(tipo)}</div>
        <div><strong>Pagamento:</strong> ${escapeHtml(pagamentoMetodo)}</div>

        <div><strong>Status pagamento:</strong> ${escapeHtml(pagamentoStatus)}</div>
        <div><strong>Troco para:</strong> ${trocoPara ? `R$ ${escapeHtml(trocoPara)}` : "-"}</div>
      </div>
    </div>

    <div class="linha"></div>

    <div class="bloco">
      <div class="titulo">${isDelivery ? "ENTREGA" : "RETIRADA"}</div>

      ${
        isDelivery
          ? `
            <p><strong>Bairro:</strong> ${escapeHtml(bairro)} ${taxaEntrega > 0 ? `(Taxa: R$ ${formatarMoeda(taxaEntrega)})` : ""}</p>
            <p><strong>Endereço:</strong> ${escapeHtml(endereco)}</p>
            <p><strong>Referência:</strong> ${escapeHtml(referencia)}</p>
          `
          : `
            <p><strong>Pedido para retirada no balcão</strong></p>
          `
      }

      <p><strong>Observações:</strong> ${escapeHtml(observacoes)}</p>
    </div>

    <div class="linha"></div>

    <div class="bloco">
      <div class="titulo">ITENS</div>
      ${
        Array.isArray(pedido.itens) && pedido.itens.length
          ? pedido.itens.map((item) => {
              const nome = escapeHtml(item.nome || "Item");
              const quantidade = Number(item.quantidade || 1);
              const valorUnitario = Number(item.valorUnitario || item.preco || 0);
              const subtotal = Number(item.subtotal || (quantidade * valorUnitario));

              const adicionais = Array.isArray(item.adicionais) && item.adicionais.length
                ? `
                  <div class="subtexto">
                    Adicionais: ${item.adicionais.map(a => escapeHtml(a.nome || a)).join(", ")}
                  </div>
                `
                : "";

              return `
                <div class="item">
                  <div>
                    <strong>${quantidade}x ${nome}</strong>
                    <div class="subtexto">Unitário: R$ ${formatarMoeda(valorUnitario)}</div>
                    <div class="subtexto">Subtotal: R$ ${formatarMoeda(subtotal)}</div>
                    ${adicionais}
                  </div>
                  <div class="destaque">R$ ${formatarMoeda(subtotal)}</div>
                </div>
              `;
            }).join("")
          : `<p>Nenhum item informado.</p>`
      }
    </div>

    <div class="linha"></div>

    <div class="total-box">
      <div class="total-linha">
        <span>Subtotal</span>
        <strong>R$ ${formatarMoeda(valorSubtotal)}</strong>
      </div>

      <div class="total-linha">
        <span>Taxa de entrega</span>
        <strong>R$ ${formatarMoeda(taxaEntrega)}</strong>
      </div>

      <div class="total-geral">
        <span>TOTAL</span>
        <span>R$ ${formatarMoeda(valorTotal)}</span>
      </div>
    </div>

    <div class="rodape">
      Via única de produção / entrega
    </div>
  </div>

  <script>
    window.onload = () => {
      setTimeout(() => {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
  `;
}

function abrirArquivoNoWindows(caminhoArquivo) {
  exec(`start "" "${caminhoArquivo}"`);
}

app.get("/status", (req, res) => {
  res.json({
    success: true,
    online: estado.online,
    fila: estado.fila,
    impressosHoje: estado.impressosHoje,
    ultimaImpressao: estado.ultimaImpressao
  });
});

app.post("/print/test", (req, res) => {
  try {
    const pedidoFake = {
      id: "TESTE-001",
      numeroPedido: "TESTE-001",
      cliente: "Teste Mesa Fácil",
      telefone: "(19) 99999-9999",
      telefoneWhatsapp: "5519999999999",

      tipo: "Delivery",
      status: "RECEBIDO",

      bairro: "Centro",
      taxaEntrega: 5,

      endereco: "Rua de Teste, 123",
      referencia: "Casa azul",
      observacoes: "Sem cebola",

      pagamentoMetodo: "DINHEIRO",
      pagamentoStatus: "PENDENTE",
      trocoPara: 50,

      valorSubtotal: 39.9,
      valorTotal: 44.9,

      itens: [
        {
          nome: "X-Burguer",
          quantidade: 2,
          valorUnitario: 17,
          subtotal: 34
        },
        {
          nome: "Coca-Cola 2L",
          quantidade: 1,
          valorUnitario: 5.9,
          subtotal: 5.9
        }
      ]
    };

    const html = gerarHtmlPedido(pedidoFake);
    const arquivo = path.join(os.tmpdir(), `mesa-facil-teste-${Date.now()}.html`);

    fs.writeFileSync(arquivo, html, "utf8");
    abrirArquivoNoWindows(arquivo);

    estado.impressosHoje += 1;
    estado.ultimaImpressao = new Date().toISOString();

    return res.json({
      success: true,
      message: "Teste enviado para impressão."
    });
  } catch (erro) {
    console.error("[PRINT TEST] Erro:", erro);
    return res.status(500).json({
      success: false,
      message: "Erro ao imprimir teste."
    });
  }
});

app.post("/print/order", (req, res) => {
  try {
    const pedido = req.body || {};

    estado.fila += 1;

    const html = gerarHtmlPedido(pedido);
    const arquivo = path.join(
      os.tmpdir(),
      `mesa-facil-pedido-${pedido.id || Date.now()}.html`
    );

    fs.writeFileSync(arquivo, html, "utf8");
    abrirArquivoNoWindows(arquivo);

    estado.fila = Math.max(0, estado.fila - 1);
    estado.impressosHoje += 1;
    estado.ultimaImpressao = new Date().toISOString();

    return res.json({
      success: true,
      message: "Pedido enviado para impressão."
    });
  } catch (erro) {
    console.error("[PRINT ORDER] Erro:", erro);
    estado.fila = Math.max(0, estado.fila - 1);

    return res.status(500).json({
      success: false,
      message: "Erro ao imprimir pedido."
    });
  }
});

app.post("/queue/clear", (req, res) => {
  estado.fila = 0;

  res.json({
    success: true,
    message: "Fila limpa."
  });
});

app.listen(PORT, () => {
  console.log(`🖨️ Printer Service rodando em http://localhost:${PORT}`);
});