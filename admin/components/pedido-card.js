function formatarHora(timestamp) {
  if (!timestamp?.seconds) return "--:--";

  return new Date(timestamp.seconds * 1000).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tempoDecorrido(timestamp) {
  if (!timestamp?.seconds) return "";

  const segundos = Math.floor(Date.now() / 1000 - timestamp.seconds);

  if (segundos < 60) return "agora";

  const minutos = Math.floor(segundos / 60);

  if (minutos < 60) {
    return `há ${minutos} min`;
  }

  const horas = Math.floor(minutos / 60);

  if (horas < 24) {
    return `há ${horas} h`;
  }

  const dias = Math.floor(horas / 24);

  return `há ${dias} dia${dias > 1 ? "s" : ""}`;
}

function corStatus(status) {
  switch (status) {
    case "RECEBIDO":
      return "status-recebido";

    case "PREPARANDO":
      return "status-preparando";

    case "PRONTO":
      return "status-pronto";

    case "ENTREGUE":
      return "status-entregue";

    default:
      return "";
  }
}

function textoBotao(status) {
  switch (status) {
    case "RECEBIDO":
      return "👨‍🍳 Iniciar preparo";

    case "PREPARANDO":
      return "✅ Pedido pronto";

    case "PRONTO":
      return "🚚 Entregar";

    default:
      return null;
  }
}

export function criarCardPedido(pedido, eventos = {}) {
  const card = document.createElement("article");

  card.className = "pedido-card";

  card.dataset.id = pedido.id;

  card.innerHTML = `
        <div class="pedido-header">

            <div class="pedido-numero">
                #${pedido.numeroPedido || pedido.id.slice(0, 6)}
            </div>

            <span class="pedido-status ${corStatus(pedido.status)}">
                ${pedido.status}
            </span>

        </div>

        <div class="pedido-cliente">
            ${pedido.cliente || "Cliente"}
        </div>

        <div class="pedido-tipo">
            ${pedido.tipo || "-"}
        </div>

        <div class="pedido-total">
            R$ ${Number(pedido.valorTotal || 0).toFixed(2)}
        </div>

        <div class="pedido-footer">

            <span>
                🕒 ${formatarHora(pedido.criadoEm)}
            </span>

            <span class="pedido-tempo" data-seconds="${pedido.criadoEm?.seconds || ""}">
                ${tempoDecorrido(pedido.criadoEm)}
            </span>

        </div>
    `;

  card.addEventListener("click", () => {
    eventos.onDetalhes?.(pedido);
  });

  const texto = textoBotao(pedido.status);

  if (texto) {
    const botao = document.createElement("button");

    botao.className = "pedido-acao";

    botao.textContent = texto;

    botao.addEventListener("click", (e) => {
      e.stopPropagation();

      eventos.onAcao?.(pedido);
    });

    card.appendChild(botao);
  }

  return card;
}

export function atualizarTemposPedidos() {
  document.querySelectorAll(".pedido-tempo").forEach((el) => {
    const seconds = Number(el.dataset.seconds);

    if (!seconds) return;

    el.textContent = tempoDecorrido({
      seconds,
    });
  });
}

setInterval(atualizarTemposPedidos, 60000);