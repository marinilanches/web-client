const iconv = require("iconv-lite");

const express = require("express");
const cors = require("cors");
const fs = require("fs");

const { execFile } = require("child_process");
const path = require("path");

const app = express();
const PORT = 3002;


const PRINTER_NAME = "ELGIN i9(COM3)";

/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO DA IMPRESSORA
|--------------------------------------------------------------------------
|
| Nome exatamente igual ao mostrado em:
| Painel de Controle > Dispositivos e Impressoras
|
*/

function imprimirRAW() {

    return new Promise((resolve, reject) => {

        const arquivo = path.join(
            __dirname,
            "raw-print.ps1"
        );

        execFile(
            "powershell",
            [
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                arquivo
            ],
            (erro, stdout, stderr) => {

                if (erro) {
                    console.error(stderr);
                    reject(erro);
                    return;
                }

                resolve();

            }
        );

    });

}

const LARGURA = 48;


const ESC = "\x1B";
const GS = "\x1D";


const CMD = {

    RESET:
        ESC + "@",

    BOLD_ON:
        ESC + "E\x01",

    BOLD_OFF:
        ESC + "E\x00",

    UNDERLINE:
        ESC + "-\x01",

    UNDERLINE_OFF:
        ESC + "-\x00",

    CENTER:
        ESC + "a\x01",

    LEFT:
        ESC + "a\x00",

    DOUBLE:
        ESC + "!\x30",

    NORMAL:
        ESC + "!\x00",

    CUT:
        GS + "V\x01"

};

/*
|--------------------------------------------------------------------------
| MIDDLEWARE
|--------------------------------------------------------------------------
*/

app.use(cors());
app.use(express.json({ limit: "2mb" }));

/*
|--------------------------------------------------------------------------
| ESTADO DO SERVIÇO
|--------------------------------------------------------------------------
*/

let estado = {

    online: true,

    fila: 0,

    impressosHoje: 0,

    ultimaImpressao: null

};

/*
|--------------------------------------------------------------------------
| UTILITÁRIOS
|--------------------------------------------------------------------------
*/

function texto(valor) {

    if (valor === undefined) return "";

    if (valor === null) return "";

    return String(valor);

}

function numero(valor) {

    return Number(valor || 0);

}

function formatarMoeda(valor) {

    return numero(valor)
        .toFixed(2)
        .replace(".", ",");

}

function moeda(valor) {

    return Number(valor || 0)
        .toFixed(2)
        .replace(".", ",");

}


function linhaDupla() {

    return "=".repeat(48);

}

function campo(nome, valor) {

    return `${nome}: ${texto(valor)}\n`;

}


function coluna(nome, valor) {

    const espaco =
        48 -
        nome.length -
        valor.length;


    return nome +
        " ".repeat(
            Math.max(1, espaco)
        )
        +
        valor;

}

function dinheiro(valor) {

    return `R$ ${formatarMoeda(valor)}`;

}

function dataAtual() {

    return new Date().toLocaleString("pt-BR");

}

function linha(caractere = "-") {
    return caractere.repeat(LARGURA);
}

function linhaDupla() {

    return "=".repeat(LARGURA);

}

function limparTexto(valor = "") {

    return String(valor)

        .normalize("NFD")

        .replace(/[\u0300-\u036f]/g, "");

}

function centralizar(textoLinha) {

    textoLinha = texto(textoLinha);

    if (textoLinha.length >= LARGURA)
        return textoLinha;

    const esquerda = Math.floor(

        (LARGURA - textoLinha.length) / 2

    );

    return " ".repeat(esquerda) + textoLinha;

}

function duasColunas(esquerda, direita) {

    esquerda = texto(esquerda);

    direita = texto(direita);

    const espacos =
        LARGURA - esquerda.length - direita.length;

    if (espacos <= 1) {

        return `${esquerda} ${direita}`;

    }

    return esquerda + " ".repeat(espacos) + direita;

}

function quebrarLinha(valor, largura = LARGURA) {

    valor = texto(valor);

    const palavras = valor.split(" ");

    const linhas = [];

    let atual = "";

    for (const palavra of palavras) {

        if ((atual + palavra).length > largura) {

            linhas.push(atual.trim());

            atual = "";

        }

        atual += palavra + " ";

    }

    if (atual.trim()) {

        linhas.push(atual.trim());

    }

    return linhas;

}


async function enviarRAW(texto) {

    const arquivoRaw = path.join(
        __dirname,
        "cupom.raw"
    );


    fs.writeFileSync(
        arquivoRaw,
        iconv.encode(texto, "cp850")
    );


    const script = path.join(
        __dirname,
        "raw-print.ps1"
    );


    return new Promise((resolve, reject) => {

        execFile(
            "powershell.exe",
            [
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                script,
                arquivoRaw
            ],
            {
                windowsHide: true
            },
            (erro, stdout, stderr) => {


                if (erro) {

                    console.error(stderr);

                    reject(erro);

                    return;

                }


                console.log(stdout);

                resolve();

            }
        );

    });

}

async function verificarImpressora() {

    return true;

}

async function iniciarImpressao() {

    const conectada =
        await verificarImpressora();

    if (!conectada) {

        throw new Error(

            `Impressora "${PRINTER_NAME}" não encontrada.`

        );

    }

}

async function imprimirPedido(pedido) {

    let cupom = "";

    cupom += CMD.RESET;

    // Código da tabela de caracteres da impressora
    // ESC t 2 = CP850
    cupom += "\x1B\x74\x02";


    // CABEÇALHO

    cupom += CMD.CENTER;

    cupom += CMD.BOLD_ON;

    cupom += CMD.DOUBLE;

    cupom += "LANCHES MARINI\n";

    cupom += CMD.NORMAL;

    cupom += CMD.BOLD_OFF;

    cupom += linhaDupla() + "\n";



    // PEDIDO

    cupom += CMD.LEFT;

    cupom += CMD.BOLD_ON;

    cupom += campo(
        "PEDIDO",
        "#" + pedido.numeroPedido
    );

    cupom += campo(
        "DATA",
        pedido.dataHora || dataAtual()
    );


    cupom += linha() + "\n";



    // CLIENTE


    cupom += CMD.BOLD_ON;

    cupom += `CLIENTE ${pedido.cliente}\n`;

    cupom += CMD.BOLD_OFF;

    cupom += `Telefone: ${pedido.telefone}\n`;



    cupom += linha() + "\n";



    // ITENS


    cupom += CMD.BOLD_ON;

    cupom += "ITENS DO PEDIDO\n";

    cupom += CMD.BOLD_OFF;



    for (const item of pedido.itens || []) {


        cupom += duasColunas(
            `${item.quantidade}x ${item.nome}`,
            "R$ " + moeda(item.valorUnitario)
        );

        cupom += "\n";



        if (item.adicionais?.length) {

            cupom += "\n";
            cupom += "COMPLEMENTOS:\n";

            for (const adicional of item.adicionais) {

                cupom += `${adicional.nome} R$ ${moeda(
                    adicional.preco || adicional.valor
                )}\n`;

            }

        }



        if (item.observacaoItem) {


            cupom += "\n";


            cupom += CMD.BOLD_ON;

            cupom +=
                "[ OBSERVACAO ]\n";


            cupom += CMD.BOLD_OFF;


            cupom +=
                item.observacaoItem.toUpperCase()
                + "\n";


        }


        cupom += "\n";

    }



    cupom += linha() + "\n";



    // ENTREGA / RETIRADA

    if (
        pedido.tipo &&
        pedido.tipo.toUpperCase() === "DELIVERY"
    ) {

        cupom += CMD.BOLD_ON;

        cupom += "ENTREGA\n";

        cupom += CMD.BOLD_OFF;


        if (pedido.endereco) {

            cupom += CMD.DOUBLE;

            cupom += "ENDEREÇO:\n\n";

            if (typeof pedido.endereco === "object") {

                const e = pedido.endereco;

                let linhaEndereco = e.rua || "";

                if (e.numero) {
                    linhaEndereco += `, ${e.numero}`;
                }

                if (e.bairro) {
                    linhaEndereco += ` ${e.bairro}`;
                }

                cupom += `${linhaEndereco}\n`;

                if (e.cep) {
                    cupom += `CEP: ${e.cep}\n`;
                }

                if (e.complemento) {

                    const linhas = quebrarLinha(
                        `Complemento: ${e.complemento}`,
                        LARGURA
                    );

                    linhas.forEach((linha) => {
                        cupom += linha + "\n";
                    });

                }

            } else {

                cupom += `${pedido.endereco}\n`;

            }

            cupom += CMD.NORMAL;

        }

    }
    else {

        cupom += CMD.BOLD_ON;

        cupom += `TIPO: ${pedido.tipo || "-"}\n`;

        cupom += CMD.BOLD_OFF;

    }


    if (pedido.observacoes) {

        cupom += CMD.BOLD_ON;

        cupom += "OBSERVAÇÕES\n";

        cupom += CMD.BOLD_OFF;

        quebrarLinha(pedido.observacoes.toUpperCase()).forEach((linha) => {
            cupom += linha + "\n";
        });

        cupom += linha() + "\n";

    } else {

        cupom += linha() + "\n";

    }



    // PAGAMENTO

    cupom += CMD.BOLD_ON;

    cupom += `PAGAMENTO ${pedido.pagamentoMetodo}\n`;

    cupom += CMD.BOLD_OFF;


    // TROCO SOMENTE PARA DINHEIRO

    if (
        pedido.pagamentoMetodo &&
        pedido.pagamentoMetodo.toUpperCase() === "DINHEIRO"
    ) {

        const total = Number(pedido.valorTotal || 0);

        if (
            pedido.trocoPara !== null &&
            pedido.trocoPara !== undefined &&
            pedido.trocoPara !== ""
        ) {

            const pago = Number(pedido.trocoPara);

            const troco = pago - total;

            cupom += `CLIENTE PAGA: R$ ${moeda(pago)}\n`;
            cupom += `TROCO: R$ ${moeda(troco)}\n`;

        }

    }


    cupom += linha() + "\n";



    // VALORES


    cupom += `Subtotal: R$ ${moeda(pedido.valorSubtotal)}\n`;

    if (
        pedido.tipo &&
        pedido.tipo.toUpperCase() === "DELIVERY"
    ) {
        cupom += `Entrega: R$ ${moeda(pedido.taxaEntrega)}\n`;
    }

    cupom += "\n";

    cupom += CMD.CENTER;

    cupom += CMD.BOLD_ON;

    cupom += CMD.DOUBLE;

    cupom += `TOTAL: R$ ${moeda(pedido.valorTotal)}\n`;

    cupom += CMD.NORMAL;

    cupom += CMD.BOLD_OFF;

    if (
        pedido.pagamentoMetodo &&
        pedido.pagamentoMetodo.toUpperCase() === "DINHEIRO" &&
        (
            pedido.trocoPara === null ||
            pedido.trocoPara === undefined ||
            pedido.trocoPara === ""
        )
    ) {
        cupom += "\n";
        cupom += CMD.LEFT;
        cupom += CMD.BOLD_ON;
        cupom += "TROCO: ";
        cupom += CMD.BOLD_OFF;
        cupom += "Cliente informou que possui trocado.\n";
    }


    cupom += CMD.NORMAL;

    cupom += CMD.BOLD_OFF;



    cupom += "\n";

    cupom += "Obrigado pela preferencia!\n";


    cupom += "\n\n\n";

    cupom += CMD.CUT;



    await enviarRAW(cupom);


    estado.impressosHoje++;

    estado.ultimaImpressao =
        new Date().toISOString();

}

/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

app.post("/print/raw-test", async (req, res) => {

    try {

        await imprimirRAW();

        res.json({
            success: true,
            message: "RAW enviado"
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            success: false,
            message: erro.message
        });

    }

});



app.get("/status", async (req, res) => {
    const online = await verificarImpressora();

    estado.online = online;

    res.json({

        success: true,

        online,

        fila: estado.fila,

        impressosHoje: estado.impressosHoje,

        ultimaImpressao: estado.ultimaImpressao

    });

});

/*
|--------------------------------------------------------------------------
| IMPRESSÃO DE TESTE
|--------------------------------------------------------------------------
*/

app.post("/print/test", async (req, res) => {

    try {

        const pedidoFake = {

            id: "TESTE-ACENTOS-001",

            numeroPedido: "271385",

            cliente: "João José da Silva Ávila",

            telefone: "(19) 99999-9999",

            telefoneWhatsapp: "5519999999999",

            tipo: "Delivery",

            status: "RECEBIDO",

            bairro: "São José do Piauí",

            endereco: "Rua João Dias da Silva, nº 203 - Vila São Luís",

            referencia: "Casa azul próxima à padaria",

            observacoes: "Sem cebola, sem pimentão, atenção à entrega rápida",

            pagamentoMetodo: "PIX",

            pagamentoStatus: "PENDENTE",

            trocoPara: 100,

            taxaEntrega: 8,

            valorSubtotal: 39.90,

            valorTotal: 47.90,


            itens: [

                {

                    nome: "X-Búrguer Especial com Queijo",

                    quantidade: 2,

                    valorUnitario: 19.95,

                    subtotal: 39.90,

                    adicionais: [

                        {

                            nome: "Hambúrguer Grande",

                            valor: 5

                        },

                        {

                            nome: "Queijo Muçarela",

                            valor: 3

                        },

                        {

                            nome: "Coração de Frango à Milanesa",

                            valor: 7

                        },

                        {

                            nome: "Pimentão Vermelho",

                            valor: 2

                        }

                    ],

                    observacaoItem: "Sem tomate, sem cebola, adicionar molho especial"

                },


                {

                    nome: "Coca-Cola 2L Gelada",

                    quantidade: 1,

                    valorUnitario: 5.90,

                    subtotal: 5.90,

                    adicionais: [],

                    observacaoItem: "Entregar bem gelada"
                },


                {

                    nome: "Açaí com Banana e Morango",

                    quantidade: 1,

                    valorUnitario: 12.50,

                    subtotal: 12.50,

                    adicionais: [

                        {

                            nome: "Leite Condensado",

                            valor: 2

                        },

                        {

                            nome: "Granola Crocante",

                            valor: 1.50

                        }

                    ],

                    observacaoItem: "Pouco açúcar"

                }

            ]

        };

        estado.fila++;

        await imprimirPedido(pedidoFake);

        estado.fila = Math.max(0, estado.fila - 1);

        res.json({

            success: true,

            message: "Impressão de teste enviada."

        });

    }

    catch (erro) {

        estado.fila = Math.max(0, estado.fila - 1);

        console.error(erro);

        res.status(500).json({

            success: false,

            message: erro.message

        });

    }

});

/*
|--------------------------------------------------------------------------
| IMPRIMIR PEDIDO
|--------------------------------------------------------------------------
*/

app.post("/print/order", async (req, res) => {

    console.log("TESTE RESTART AUTOMATICO");

    console.log("==============================");
    console.log("JSON RECEBIDO:");
    console.log(JSON.stringify(req.body, null, 2));

    console.log("typeof endereco:", typeof req.body.endereco);
    console.log("endereco:", req.body.endereco);

    console.log("==============================");


    try {

        const pedido = req.body || {};

        estado.fila++;

        await imprimirPedido(pedido);

        estado.fila = Math.max(0, estado.fila - 1);


        res.json({
            success: true,
            message: "Pedido impresso com sucesso."
        });


    } catch (erro) {

        estado.fila = Math.max(0, estado.fila - 1);

        console.error("Erro ao imprimir pedido:");
        console.error(erro);


        res.status(500).json({
            success: false,
            message: erro.message
        });

    }

});

/*
|--------------------------------------------------------------------------
| LIMPAR FILA
|--------------------------------------------------------------------------
*/

app.post("/queue/clear", (req, res) => {

    estado.fila = 0;

    res.json({

        success: true,

        message: "Fila limpa."

    });

});

/*
|--------------------------------------------------------------------------
| INICIALIZAÇÃO
|--------------------------------------------------------------------------
*/

console.log("======================================");
console.log(" NOVO PRINTER.JS - ESC/POS ");
console.log("======================================");

app.listen(PORT, async () => {
    console.log("SERVIDOR NOVO INICIADO");

    const online = await verificarImpressora();

    estado.online = online;

    console.log("");

    console.log("======================================");

    console.log(" Mesa Facil - Printer Service");

    console.log("======================================");

    console.log(`Servidor : http://localhost:${PORT}`);

    console.log(`Impressora : ${PRINTER_NAME}`);

    console.log(

        `Status : ${online ? "ONLINE" : "OFFLINE"}`

    );

    console.log("======================================");

    console.log("");

});