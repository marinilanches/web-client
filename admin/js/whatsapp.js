const statusEl = document.getElementById("statusWhatsapp");
const numeroEl = document.getElementById("numeroWhatsapp");
const mensagensEl = document.getElementById("mensagensEnviadas");
const atualizacaoEl = document.getElementById("ultimaAtualizacao");

const qrImg = document.getElementById("qrCode");
const semQrEl = document.getElementById("semQr");

const btnAtualizarQR = document.getElementById("btnAtualizarQR");
const btnReconectar = document.getElementById("btnReconectar");

const API_BASE = "http://localhost:3001/api/whatsapp";

function traduzirStatus(status) {
    switch (status) {
        case "CONECTADO":
            return "Conectado";
        case "AUTENTICADO":
            return "Autenticando...";
        case "AGUARDANDO_QR":
            return "Aguardando QR Code";
        case "RECONECTANDO":
            return "Reconectando...";
        case "FALHA_AUTENTICACAO":
            return "Falha de autenticação";
        case "DESCONECTADO":
        default:
            return "Desconectado";
    }
}

function formatarData(dataIso) {
    if (!dataIso) return "--";
    return new Date(dataIso).toLocaleString("pt-BR");
}

function renderWhatsapp(data) {
    statusEl.textContent = traduzirStatus(data.status);
    numeroEl.textContent = data.numero || "-";
    mensagensEl.textContent = data.mensagensHoje ?? 0;
    atualizacaoEl.textContent = formatarData(data.ultimaAtualizacao);

    if (data.qrCode) {
        qrImg.src = data.qrCode;
        qrImg.style.display = "block";
        semQrEl.style.display = "none";
    } else {
        qrImg.removeAttribute("src");
        qrImg.style.display = "none";

        if (data.status === "CONECTADO") {
            semQrEl.textContent = "WhatsApp conectado com sucesso.";
        } else if (data.status === "RECONECTANDO") {
            semQrEl.textContent = "Reconectando WhatsApp...";
        } else if (data.status === "AUTENTICADO") {
            semQrEl.textContent = "Autenticando sessão...";
        } else {
            semQrEl.textContent = "Aguardando QR Code...";
        }

        semQrEl.style.display = "block";
    }
}

async function carregarStatusWhatsapp() {
    try {
        const resposta = await fetch(`${API_BASE}/status`);
        const data = await resposta.json();

        console.log("Status WhatsApp recebido:", data);

        if (!data.success) {
            throw new Error("Falha ao obter status do WhatsApp.");
        }

        renderWhatsapp(data);
    } catch (erro) {
        console.error("Erro ao carregar status do WhatsApp:", erro);

        statusEl.textContent = "Offline";
        numeroEl.textContent = "-";
        mensagensEl.textContent = "0";
        atualizacaoEl.textContent = "--";

        qrImg.style.display = "none";
        semQrEl.style.display = "block";
        semQrEl.textContent = "Não foi possível conectar ao serviço do WhatsApp.";
    }
}

async function reconectarWhatsapp() {
    try {
        btnReconectar.disabled = true;
        btnAtualizarQR.disabled = true;

        await fetch(`${API_BASE}/reconnect`, {
            method: "POST"
        });

        setTimeout(() => {
            carregarStatusWhatsapp();
        }, 1500);
    } catch (erro) {
        console.error("Erro ao reconectar WhatsApp:", erro);
        alert("Não foi possível reconectar o WhatsApp.");
    } finally {
        setTimeout(() => {
            btnReconectar.disabled = false;
            btnAtualizarQR.disabled = false;
        }, 2000);
    }
}

btnAtualizarQR?.addEventListener("click", carregarStatusWhatsapp);
btnReconectar?.addEventListener("click", reconectarWhatsapp);

carregarStatusWhatsapp();
setInterval(carregarStatusWhatsapp, 5000);