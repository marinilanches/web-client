const { beeRequest } = require("./bee");

async function solicitarEntregador(pedido) {
  if (pedido.tipo !== "Delivery") {
    console.log("[BEE] Pedido não é delivery");

    return null;
  }

  if (config.MOCK) {
    return {
      id: "TESTE_BEE_123",

      status: "CREATED",
    };
  }

  const dados = {
    pedidoId: pedido.id,

    cliente: {
      nome: pedido.cliente,

      telefone: pedido.telefone,
    },

    endereco: {
      rua: pedido.endereco?.rua,

      numero: pedido.endereco?.numero,

      bairro: pedido.endereco?.bairro,

      complemento: pedido.endereco?.complemento,

      latitude: pedido.latitude,

      longitude: pedido.longitude,
    },

    valor: pedido.valorTotal,

    observacao: pedido.observacoes || "",
  };

  const resposta = await beeRequest("/api/v1/open-delivery/orders", dados);

  return resposta;
}

module.exports = {
  solicitarEntregador,
};
