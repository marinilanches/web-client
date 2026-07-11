const express = require("express");
const cors = require("cors");

const { execFile } = require("child_process");
const path = require("path");

const {
ThermalPrinter,
PrinterTypes,
CharacterSet
} = require("node-thermal-printer");

const app = express();
const PORT = 3002;

/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO DA IMPRESSORA
|--------------------------------------------------------------------------
|
| Nome exatamente igual ao mostrado em:
| Painel de Controle > Dispositivos e Impressoras
|
*/

const PRINTER_NAME = "ELGIN i9(COM3)";

function imprimirRAW(){

    return new Promise((resolve,reject)=>{

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
            (erro, stdout, stderr)=>{

                if(erro){
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

function enviarRAW(texto){

    return new Promise((resolve,reject)=>{


        const script = path.join(
            __dirname,
            "raw-print.ps1"
        );


        execFile(
            "powershell",
            [
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                script,
                texto
            ],
            (erro, stdout, stderr)=>{


                if(erro){
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

    printer.clear();

    printer.alignLeft();

    printer.setTextNormal();

    printer.bold(false);

}

async function imprimirPedido(pedido) {

  throw new Error("TESTE NOVO PRINTER");

    const conectada = await verificarImpressora();

    if (!conectada) {
        throw new Error(`Impressora "${PRINTER_NAME}" não encontrada.`);
    }

    await iniciarImpressao();

    const numero = pedido.numeroPedido || pedido.id || "-";

    const cliente = pedido.cliente || "CLIENTE NAO INFORMADO";

    const telefone = pedido.telefone || "-";

    const whatsapp = pedido.telefoneWhatsapp || "-";

    const tipo = pedido.tipo || "Delivery";

    const status = pedido.status || "RECEBIDO";

    const endereco = pedido.endereco || "";

    const bairro = pedido.bairro || "";

    const referencia = pedido.referencia || "";

    const observacoes = pedido.observacoes || "";

    const pagamentoMetodo = pedido.pagamentoMetodo || "-";

    const pagamentoStatus = pedido.pagamentoStatus || "-";

    const trocoPara =
        Number(pedido.trocoPara || 0);

    /*
    ====================================================
    CABEÇALHO
    ====================================================
    */

    printer.alignCenter();

    printer.println(linha("="));

    printer.bold(true);

    printer.setTextDoubleHeight();
    printer.setTextDoubleWidth();

    printer.println("MESA FACIL");

    printer.setTextNormal();

    printer.bold(false);

    printer.println(dataAtual());

    printer.println(linha("="));

    printer.drawLine();

    /*
    ====================================================
    PEDIDO
    ====================================================
    */

    printer.alignCenter();

    printer.bold(true);

    printer.setTextQuadArea();

    printer.println(numero);

    printer.setTextNormal();

    printer.bold(false);

    printer.println("PEDIDO");

    printer.drawLine();

    /*
    ====================================================
    CLIENTE
    ====================================================
    */

    printer.alignLeft();

    printer.bold(true);

    printer.println("CLIENTE");

    printer.setTextDoubleWidth();

    printer.println(
        limparTexto(cliente.toUpperCase())
    );

    printer.setTextNormal();

    printer.bold(false);

    printer.drawLine();

    printer.println(`Telefone : ${telefone}`);

    if (whatsapp && whatsapp !== "-") {
      printer.println(`WhatsApp : ${whatsapp}`);
    }

    printer.drawLine();

    /*
    ====================================================
    ENTREGA
    ====================================================
    */

    printer.bold(true);

    printer.println(
        tipo === "Delivery"
            ? "ENTREGA"
            : "RETIRADA"
    );

    printer.println(`Status : ${status}`);

    printer.bold(false);

    if (tipo === "Delivery") {

        if (endereco)
            quebrarLinha(endereco)
                .forEach(l => printer.println(l));

        if (bairro)
            printer.println(`Bairro : ${bairro}`);

        if (referencia)
            printer.println(`Ref.    : ${referencia}`);

    } else {

        printer.println("RETIRAR NO BALCAO");

    }

    printer.drawLine();

    /*
    ====================================================
    PAGAMENTO
    ====================================================
    */

    printer.bold(true);

    printer.println("PAGAMENTO");

    printer.bold(false);

    printer.println(`Metodo : ${pagamentoMetodo}`);

    printer.println(`Status : ${pagamentoStatus}`);

    if (trocoPara > 0) {

        printer.println(

            `Troco : ${dinheiro(trocoPara)}`

        );

    }

    printer.drawLine();

    /*
    ====================================================
    OBSERVAÇÕES GERAIS
    ====================================================
    */

    if (observacoes.trim() !== "") {

        printer.bold(true);

        printer.println("OBSERVACOES");

        printer.bold(false);

        quebrarLinha(observacoes)
            .forEach(l => printer.println(l));

        printer.drawLine();

    }

    /*
====================================================
ITENS DO PEDIDO
====================================================
*/

printer.alignLeft();

printer.bold(true);
printer.setTextSize(1, 1);
printer.println("ITENS DO PEDIDO");
printer.bold(false);

printer.drawLine();

if (!Array.isArray(pedido.itens) || pedido.itens.length === 0) {

    printer.println("Nenhum item informado.");

    printer.drawLine();

} else {

    for (const item of pedido.itens) {

        const quantidade = Number(item.quantidade || 1);

        const nome = texto(item.nome || "ITEM");

        const valorUnitario = Number(
            item.valorUnitario ??
            item.preco ??
            0
        );

        const subtotal = Number(
            item.subtotal ??
            quantidade * valorUnitario
        );

        /*
        -----------------------------------------
        PRODUTO
        -----------------------------------------
        */

        printer.bold(true);

        printer.println(

            `${quantidade}x ${limparTexto(nome)}`

        );

        printer.bold(false);

        printer.println(

            duasColunas(
                dinheiro(valorUnitario),
                dinheiro(subtotal)
            )

        );

        /*
        -----------------------------------------
        ADICIONAIS
        -----------------------------------------
        */

        if (
            Array.isArray(item.adicionais) &&
            item.adicionais.length
        ) {

            printer.bold(true);

            printer.println("Adicionais");

            printer.bold(false);

            for (const adicional of item.adicionais) {

                if (typeof adicional === "string") {

                    quebrarLinha(`+ ${adicional}`)
                        .forEach(l => printer.println(l));

                } else {

                    const nomeAdicional =
                        adicional.nome || "Adicional";

                    const valorAdicional =
                        Number(adicional.valor || 0);

                    if (valorAdicional > 0) {

                        printer.println(

                            duasColunas(
                                `+ ${nomeAdicional}`,
                                dinheiro(valorAdicional)
                            )

                        );

                    } else {

                        printer.println(
                            `+ ${nomeAdicional}`
                        );

                    }

                }

            }

        }

        /*
        -----------------------------------------
        OBSERVAÇÃO DO ITEM
        -----------------------------------------
        */

        if (
            item.observacaoItem &&
            item.observacaoItem.trim() !== ""
        ) {

            printer.bold(true);

            printer.println("OBS:");

            printer.bold(false);

            quebrarLinha(item.observacaoItem)
                .forEach(l => printer.println(l));

        }

        printer.drawLine();

    }

}

/*
====================================================
RESUMO DO PEDIDO
====================================================
*/

const totalItens = Array.isArray(pedido.itens)
    ? pedido.itens.reduce(
        (total, item) => total + Number(item.quantidade || 0),
        0
    )
    : 0;

const subtotal = Number(pedido.valorSubtotal || 0);

const taxaEntrega = Number(pedido.taxaEntrega || 0);

const total = Number(
    pedido.valorTotal ??
    (subtotal + taxaEntrega)
);

printer.bold(true);

printer.println("RESUMO DO PEDIDO");

printer.bold(false);

printer.drawLine();

printer.println(
    duasColunas(
        "Itens",
        String(totalItens)
    )
);

printer.println(
    duasColunas(
        "Subtotal",
        dinheiro(subtotal)
    )
);

printer.println(
    duasColunas(
        "Entrega",
        dinheiro(taxaEntrega)
    )
);

printer.drawLine();

/*
====================================================
TOTAL
====================================================
*/

printer.println(linha("="));

printer.alignCenter();

printer.bold(true);

printer.println("TOTAL");

printer.setTextQuadArea();

printer.println(dinheiro(total));

printer.setTextNormal();

printer.bold(false);

printer.println(linha("="));

printer.drawLine();

/*
====================================================
FORMA DE PAGAMENTO
====================================================
*/

printer.bold(true);

printer.println("FORMA DE PAGAMENTO");

printer.bold(false);

printer.println(
    limparTexto(
        pagamentoMetodo.toUpperCase()
    )
);

printer.setTextSize(1, 1);

if (
    pagamentoStatus &&
    pagamentoStatus !== "-"
) {

    printer.println(
        `Status: ${pagamentoStatus}`
    );

}

printer.drawLine();

/*
====================================================
RODAPÉ
====================================================
*/

printer.drawLine();

printer.alignCenter();

printer.println("MESA FACIL");

printer.println(dataAtual());

printer.println("");

printer.println("COZINHA");

printer.println("");

printer.println("OBRIGADO!");

printer.newLine();

/*
====================================================
ALIMENTAÇÃO DO PAPEL
====================================================
*/

printer.newLine();
printer.newLine();
printer.newLine();
printer.newLine();

/*
====================================================
CORTE AUTOMÁTICO
====================================================
*/

printer.newLine();
printer.newLine();
printer.newLine();

printer.cut();

await enviarRAW(cupom);

/*
====================================================
ATUALIZA STATUS
====================================================
*/

estado.impressosHoje++;

estado.ultimaImpressao =
    new Date().toISOString();

/*
====================================================
FIM
====================================================
*/

}

/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

app.post("/print/raw-test", async (req,res)=>{

    try {

        await imprimirRAW();

        res.json({
            success:true,
            message:"RAW enviado"
        });

    } catch(erro){

        console.error(erro);

        res.status(500).json({
            success:false,
            message:erro.message
        });

    }

});



app.get("/status", async (req, res) => {    const online = await verificarImpressora();

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

            id: "TESTE-001",

            numeroPedido: "TESTE-001",

            cliente: "Cliente Teste",

            telefone: "(19) 99999-9999",

            telefoneWhatsapp: "5519999999999",

            tipo: "Delivery",

            status: "RECEBIDO",

            bairro: "Centro",

            endereco: "Rua de Teste, 123",

            referencia: "Casa Azul",

            observacoes: "Sem cebola",

            pagamentoMetodo: "DINHEIRO",

            pagamentoStatus: "PENDENTE",

            trocoPara: 100,

            taxaEntrega: 5,

            valorSubtotal: 39.90,

            valorTotal: 44.90,

            itens: [

                {

                    nome: "X-Burguer",

                    quantidade: 2,

                    valorUnitario: 17,

                    subtotal: 34,

                    adicionais: [

                        {

                            nome: "Bacon",

                            valor: 4

                        },

                        {

                            nome: "Cheddar",

                            valor: 3

                        }

                    ],

                    observacaoItem: "Sem tomate"

                },

                {

                    nome: "Coca-Cola 2L",

                    quantidade: 1,

                    valorUnitario: 5.90,

                    subtotal: 5.90

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

    try {

        const pedido = req.body || {};

        estado.fila++;

        await imprimirPedido(pedido);

        estado.fila = Math.max(0, estado.fila - 1);

        res.json({

            success: true,

            message: "Pedido impresso com sucesso."

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

    console.log(" Mesa Fácil - Printer Service");

    console.log("======================================");

    console.log(`Servidor : http://localhost:${PORT}`);

    console.log(`Impressora : ${PRINTER_NAME}`);

    console.log(

        `Status : ${online ? "ONLINE" : "OFFLINE"}`

    );

    console.log("======================================");

    console.log("");

});