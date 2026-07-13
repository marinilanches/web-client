const { pagbankConfig } = require("./pagbank-config");

/* ==========================================================
   PAGBANK SERVICE
========================================================== */

async function criarPedidoPixPagBank(pedido) {
  const body = {
    reference_id: pedido.numeroPedido || "XXX",
    customer: {
      name: pedido.cliente || "XXX",
      email: pedido.email || "XXX",
      tax_id: pedido.cpf || "XXX",
      phones: [
        {
          country: "55",
          area: "19",
          number: "999999999",
          type: "MOBILE"
        }
      ]
    },
    items: (pedido.itens || []).map((item) => ({
      name: item.nome,
      quantity: Number(item.quantidade || 1),
      unit_amount: Math.round(Number(item.valorUnitario || 0) * 100)
    })),
    qr_codes: [
      {
        amount: {
          value: Math.round(Number(pedido.valorTotal || 0) * 100)
        }
      }
    ],
    notification_urls: pagbankConfig.webhookUrl
      ? [pagbankConfig.webhookUrl]
      : []
  };

  const response = await fetch(`${pagbankConfig.baseUrl}/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${pagbankConfig.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

module.exports = {
  criarPedidoPixPagBank
};