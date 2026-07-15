export function timeToMinutes(timeString) {
  if (!timeString || typeof timeString !== "string") return null;

  const [hour, minute] = timeString.split(":").map(Number);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return hour * 60 + minute;
}

export function isStoreOpen(funcionamento = {}) {
  const statusManual = funcionamento.statusManual || "AUTO";

  if (statusManual === "ABERTA") return true;
  if (statusManual === "FECHADA") return false;

  const abertura = timeToMinutes(funcionamento.abertura);
  const fechamento = timeToMinutes(funcionamento.fechamento);

  if (abertura === null || fechamento === null) {
    return true;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (abertura < fechamento) {
    return currentMinutes >= abertura &&
           currentMinutes < fechamento;
  }

  if (abertura > fechamento) {
    return currentMinutes >= abertura ||
           currentMinutes < fechamento;
  }

  return true;
}