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


const ESC="\x1B";
const GS="\x1D";


const CMD={

RESET:
ESC+"@",

BOLD_ON:
ESC+"E\x01",

BOLD_OFF:
ESC+"E\x00",

UNDERLINE:
ESC+"-\x01",

UNDERLINE_OFF:
ESC+"-\x00",

CENTER:
ESC+"a\x01",

LEFT:
ESC+"a\x00",

DOUBLE:
ESC+"!\x30",

NORMAL:
ESC+"!\x00",

CUT:
GS+"V\x01"

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

function moeda(valor){

    return Number(valor || 0)
        .toFixed(2)
        .replace(".",",");

}


function linha(){

    return "-".repeat(48);

}


function linhaDupla(){

    return "=".repeat(48);

}


function coluna(nome,valor){

    const espaco =
        48 -
        nome.length -
        valor.length;


    return nome +
        " ".repeat(
            Math.max(1,espaco)
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


function enviarRAW(texto){

    return new Promise((resolve,reject)=>{


        const arquivoRaw = path.join(
            __dirname,
            "cupom.raw"
        );


        fs.writeFileSync(
            arquivoRaw,
            texto,
            "binary"
        );


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
                arquivoRaw
            ],
            (erro, stdout, stderr)=>{


                if(erro){

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

async function imprimirPedido(pedido){


let cupom="";


cupom += CMD.RESET;



// CABEÇALHO

cupom += CMD.CENTER;

cupom += CMD.BOLD_ON;

cupom += CMD.DOUBLE;

cupom += "MESA FACIL\n";

cupom += CMD.NORMAL;

cupom += CMD.BOLD_OFF;

cupom += linhaDupla()+"\n";



// PEDIDO

cupom += CMD.LEFT;

cupom += CMD.BOLD_ON;

cupom +=
`PEDIDO #${pedido.numeroPedido}\n`;

cupom += CMD.BOLD_OFF;


cupom +=
`${pedido.dataHora || dataAtual()}\n`;


cupom += linha()+"\n";



// CLIENTE


cupom += "CLIENTE\n";


cupom += CMD.BOLD_ON;

cupom +=
`${pedido.cliente}\n`;

cupom += CMD.BOLD_OFF;


cupom +=
`Telefone:\n${pedido.telefone}\n`;



cupom += linha()+"\n";



// ITENS


cupom += CMD.BOLD_ON;

cupom += "ITENS DO PEDIDO\n";

cupom += CMD.BOLD_OFF;



for(const item of pedido.itens || []){


cupom += CMD.BOLD_ON;


cupom +=
`${item.quantidade}x ${item.nome}\n`;


cupom += CMD.BOLD_OFF;



cupom +=
coluna(
"",
"R$ "+
moeda(item.valorUnitario)
)
+"\n";



if(item.adicionais?.length){


cupom +=
"\nCOMPLEMENTOS:\n";


for(const adicional of item.adicionais){


cupom +=
"  - "+
coluna(
adicional.nome,
"R$ "+moeda(adicional.preco)
)
+"\n";


}


}



if(item.observacaoItem){


cupom += "\n";


cupom += CMD.BOLD_ON;

cupom +=
"[ OBSERVACAO ]\n";


cupom += CMD.BOLD_OFF;


cupom +=
item.observacaoItem.toUpperCase()
+"\n";


}


cupom+="\n";

}



cupom += linha()+"\n";



// ENTREGA


cupom += CMD.BOLD_ON;

cupom+="ENTREGA\n";

cupom+=CMD.BOLD_OFF;


cupom+="BAIRRO:\n";

cupom+=
pedido.bairro+"\n\n";


cupom+=CMD.DOUBLE;


cupom+=
"ENDERECO:\n";


cupom+=CMD.NORMAL;


cupom+=
pedido.endereco+"\n";


if(pedido.referencia){

cupom+=
"\nREFERENCIA:\n";

cupom+=
pedido.referencia+"\n";

}



cupom+=linha()+"\n";



// PAGAMENTO


cupom+=CMD.BOLD_ON;

cupom+="PAGAMENTO\n";

cupom+=CMD.BOLD_OFF;


cupom+=CMD.BOLD_ON;

cupom+=
pedido.pagamentoMetodo+"\n";

cupom+=CMD.BOLD_OFF;



cupom+=linha()+"\n";



// VALORES


cupom+=
coluna(
"Subtotal:",
"R$ "+moeda(pedido.valorSubtotal)
)
+"\n";


cupom+=
coluna(
"Entrega:",
"R$ "+moeda(pedido.taxaEntrega)
)
+"\n\n";



cupom+=CMD.CENTER;

cupom+=CMD.BOLD_ON;

cupom+=CMD.DOUBLE;


cupom+=
"TOTAL\n";


cupom+=
"R$ "+moeda(pedido.valorTotal)
+"\n";


cupom+=CMD.NORMAL;

cupom+=CMD.BOLD_OFF;



cupom+="\n";

cupom+="Obrigado pela preferencia!\n";


cupom+="\n\n\n";

cupom+=CMD.CUT;



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

    console.log("==============================");
    console.log("JSON RECEBIDO:");
    console.log(JSON.stringify(req.body, null, 2));
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