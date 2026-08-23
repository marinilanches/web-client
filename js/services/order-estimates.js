const DEFAULT_TEMPOS_ESTIMADOS = {
  retirada: {
    minimo: 20,
    maximo: 30,
  },
  entrega: {
    minimo: 120,
    maximo: 130,
  },
};

function numeroValido(valor) {
  return Number.isFinite(Number(valor));
}

export function normalizarTempoEstimado(tempo = {}) {
  const retirada = tempo?.retirada || {};
  const entrega = tempo?.entrega || {};

  const retiradaMinimo = numeroValido(retirada.minimo)
    ? Number(retirada.minimo)
    : DEFAULT_TEMPOS_ESTIMADOS.retirada.minimo;

  const retiradaMaximo = numeroValido(retirada.maximo)
    ? Number(retirada.maximo)
    : DEFAULT_TEMPOS_ESTIMADOS.retirada.maximo;

  const entregaMinimo = numeroValido(entrega.minimo)
    ? Number(entrega.minimo)
    : DEFAULT_TEMPOS_ESTIMADOS.entrega.minimo;

  const entregaMaximo = numeroValido(entrega.maximo)
    ? Number(entrega.maximo)
    : DEFAULT_TEMPOS_ESTIMADOS.entrega.maximo;

  return {
    retirada: {
      minimo: retiradaMinimo,
      maximo: retiradaMaximo,
    },

    entrega: {
      minimo: entregaMinimo,
      maximo: entregaMaximo,
    },
  };
}

export function validarTempoEstimado(minimo, maximo) {
  const min = Number(minimo);
  const max = Number(maximo);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("TEMPO_ESTIMADO_INVALIDO");
  }

  if (min < 0 || max < 0) {
    throw new Error("TEMPO_ESTIMADO_NEGATIVO");
  }

  if (max < min) {
    throw new Error("TEMPO_ESTIMADO_MAXIMO_MENOR");
  }

  return {
    minimo: min,
    maximo: max,
  };
}

export function obterEstimativaPorTipo(configuracoes = {}, tipo) {
  const tempos = normalizarTempoEstimado(
    configuracoes?.tempoEstimado,
  );

  if (tipo === "Retirada") {
    return {
      tipo: "Retirada",
      ...tempos.retirada,
    };
  }

  return {
    tipo: "Delivery",
    ...tempos.entrega,
  };
}

export function calcularHorarioFinalEstimativa(
  estimativa,
  dataBase = new Date(),
) {
  if (!estimativa) return null;

  const minutos = Number(estimativa.maximo);

  if (!Number.isFinite(minutos)) {
    return null;
  }

  const resultado = new Date(dataBase);
  resultado.setMinutes(resultado.getMinutes() + minutos);

  return resultado;
}

export function formatarHorarioEstimativa(data) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) {
    return "—";
  }

  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function textoDiaEstimativa(data, referencia = new Date()) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) {
    return "—";
  }

  const hoje = new Date(referencia);
  hoje.setHours(0, 0, 0, 0);

  const dia = new Date(data);
  dia.setHours(0, 0, 0, 0);

  const diferenca =
    Math.round((dia - hoje) / 86400000);

  if (diferenca === 0) {
    return "Hoje";
  }

  if (diferenca === 1) {
    return "Amanhã";
  }

  return dia.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function renderEstimativaTempo(
  configuracoes,
  tipo,
  dataBase = new Date(),
) {
  const estimativa = obterEstimativaPorTipo(
    configuracoes,
    tipo,
  );

  const horarioFinal =
    calcularHorarioFinalEstimativa(
      estimativa,
      dataBase,
    );

  const dia = textoDiaEstimativa(
    horarioFinal,
    dataBase,
  );

  const icone =
    tipo === "Retirada"
      ? "🛍️"
      : "🚚";

  const titulo =
    tipo === "Retirada"
      ? "Retirada"
      : "Entrega";

  const frase =
    tipo === "Retirada"
      ? "Pronto para retirar até"
      : "Chegará até";

  return {
    tipo,
    minimo: estimativa.minimo,
    maximo: estimativa.maximo,
    titulo,
    icone,
    dia,
    horarioFinal,
    frase,
    intervalo: `${estimativa.minimo}–${estimativa.maximo} min`,
    horarioFormatado: formatarHorarioEstimativa(
      horarioFinal,
    ),
  };
}