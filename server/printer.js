const iconv = require("iconv-lite");

const express = require("express");
const cors = require("cors");

const fs = require("fs");
const path = require("path");

const { execFile } = require("child_process");


const app = express();

const PORT = 3002;


/*
|--------------------------------------------------------------------------
| IMPRESSÃO
|--------------------------------------------------------------------------
*/

const LARGURA = 48;

const LARGURA_DUPLA =
    Math.floor(LARGURA / 2);


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

app.use(
    express.json({
        limit: "2mb"
    })
);


/*
|--------------------------------------------------------------------------
| ESTADO
|--------------------------------------------------------------------------
*/

let estado = {

    online: false,

    fila: 0,

    impressosHoje: 0,

    ultimaImpressao: null,

    impressora: null

};


/*
|--------------------------------------------------------------------------
| UTILITÁRIOS
|--------------------------------------------------------------------------
*/

function texto(valor) {

    if (
        valor === undefined ||
        valor === null
    ) {
        return "";
    }

    return String(valor);
}


function numero(valor) {

    const resultado =
        Number(valor || 0);

    return Number.isFinite(resultado)
        ? resultado
        : 0;
}


function formatarMoeda(valor) {

    return numero(valor)
        .toFixed(2)
        .replace(".", ",");

}


function moeda(valor) {

    return formatarMoeda(valor);

}


function dinheiro(valor) {

    return `R$ ${formatarMoeda(valor)}`;

}


function dataAtual() {

    return new Date()
        .toLocaleString("pt-BR");

}


function linha(
    caractere = "-"
) {

    return caractere.repeat(
        LARGURA
    );

}


function linhaDupla() {

    return linha("=");

}


function campo(
    nome,
    valor
) {

    return `${nome}: ${texto(valor)}\n`;

}


function duasColunas(
    esquerda,
    direita
) {

    esquerda = texto(esquerda);

    direita = texto(direita);


    const espacos =

        LARGURA -

        esquerda.length -

        direita.length;


    if (espacos <= 1) {

        return (
            esquerda +
            " " +
            direita
        );

    }


    return (

        esquerda +

        " ".repeat(espacos) +

        direita

    );

}


function quebrarLinha(
    valor,
    largura = LARGURA
) {

    valor = texto(valor)
        .trim();


    if (!valor) {

        return [];

    }


    const palavras =
        valor.split(/\s+/);


    const linhas = [];

    let atual = "";


    for (
        const palavra of palavras
    ) {

        /*
        Se uma única palavra for
        maior que a largura.
        */

        if (
            palavra.length >
            largura
        ) {

            if (atual) {

                linhas.push(atual);

                atual = "";

            }


            let restante =
                palavra;


            while (
                restante.length >
                largura
            ) {

                linhas.push(

                    restante.substring(
                        0,
                        largura
                    )

                );


                restante =

                    restante.substring(
                        largura
                    );

            }


            atual =
                restante;


            continue;

        }


        const candidato =

            atual

                ? `${atual} ${palavra}`

                : palavra;


        if (
            candidato.length >
            largura
        ) {

            linhas.push(atual);

            atual =
                palavra;

        } else {

            atual =
                candidato;

        }

    }


    if (atual) {

        linhas.push(atual);

    }


    return linhas;

}


/*
|--------------------------------------------------------------------------
| DETECTAR IMPRESSORA
|--------------------------------------------------------------------------
*/

function detectarImpressora() {

    return new Promise(
        (resolve, reject) => {

            const script =

                path.join(
                    __dirname,
                    "raw-print.ps1"
                );


            execFile(

                "powershell.exe",

                [
                    "-NoProfile",

                    "-ExecutionPolicy",
                    "Bypass",

                    "-File",
                    script,

                    "-DetectOnly"
                ],

                {
                    windowsHide: true
                },

                (
                    erro,
                    stdout,
                    stderr
                ) => {

                    if (erro) {

                        const mensagem =

                            texto(stderr)
                                .trim() ||

                            erro.message;


                        reject(

                            new Error(
                                mensagem
                            )

                        );

                        return;

                    }


                    const nome =

                        texto(stdout)
                            .trim();


                    if (!nome) {

                        reject(

                            new Error(
                                "Nenhuma impressora Elgin detectada."
                            )

                        );

                        return;

                    }


                    resolve(nome);

                }

            );

        }

    );

}


/*
|--------------------------------------------------------------------------
| STATUS DA IMPRESSORA
|--------------------------------------------------------------------------
*/

async function verificarImpressora() {

    try {

        const nome =

            await detectarImpressora();


        estado.online = true;

        estado.impressora =
            nome;


        return true;

    } catch (erro) {

        estado.online = false;

        estado.impressora =
            null;


        console.error(
            "[PRINTER] Impressora não detectada:",
            erro.message
        );


        return false;

    }

}


async function iniciarImpressao() {

    const conectada =

        await verificarImpressora();


    if (!conectada) {

        throw new Error(

            "Nenhuma impressora ELGIN i9 foi encontrada no Windows."

        );

    }

}


/*
|--------------------------------------------------------------------------
| CRIAR ARQUIVO RAW E ENVIAR
|--------------------------------------------------------------------------
*/

async function enviarRAW(
    conteudo
) {

    /*
    Arquivo único para evitar
    que dois pedidos simultâneos
    sobrescrevam cupom.raw.
    */

    const nomeArquivo =

        `cupom-${Date.now()}-${process.pid}-${Math.random()
            .toString(36)
            .slice(2, 8)}.raw`;


    const arquivoRaw =

        path.join(
            __dirname,
            nomeArquivo
        );


    const script =

        path.join(
            __dirname,
            "raw-print.ps1"
        );


    try {

        /*
        Elgin configurada para
        tabela CP850.
        */

        const buffer =

            iconv.encode(
                conteudo,
                "cp850"
            );


        fs.writeFileSync(
            arquivoRaw,
            buffer
        );


        await new Promise(
            (
                resolve,
                reject
            ) => {

                execFile(

                    "powershell.exe",

                    [
                        "-NoProfile",

                        "-ExecutionPolicy",
                        "Bypass",

                        "-File",
                        script,

                        "-arquivoRaw",
                        arquivoRaw
                    ],

                    {
                        windowsHide: true,

                        maxBuffer:
                            1024 * 1024
                    },

                    (
                        erro,
                        stdout,
                        stderr
                    ) => {

                        if (erro) {

                            console.error(
                                "[PRINTER RAW]",
                                stderr
                            );


                            reject(

                                new Error(

                                    texto(stderr)
                                        .trim() ||

                                    erro.message

                                )

                            );


                            return;

                        }


                        const resposta =

                            texto(stdout)
                                .trim();


                        if (resposta) {

                            console.log(
                                resposta
                            );

                        }


                        resolve();

                    }

                );

            }

        );

    } finally {

        /*
        Remove o arquivo temporário
        mesmo se a impressão falhar.
        */

        try {

            if (
                fs.existsSync(
                    arquivoRaw
                )
            ) {

                fs.unlinkSync(
                    arquivoRaw
                );

            }

        } catch (
            erroLimpeza
        ) {

            console.warn(

                "[PRINTER] Não foi possível remover RAW temporário:",

                erroLimpeza.message

            );

        }

    }

}


/*
|--------------------------------------------------------------------------
| PEDIDO
|--------------------------------------------------------------------------
*/

async function imprimirPedido(
    pedido
) {

    await iniciarImpressao();


    let cupom = "";


    /*
    ============================================================
    RESET + CP850
    ============================================================
    */

    cupom +=
        CMD.RESET;


    /*
    ESC t 2
    Tabela CP850
    */

    cupom +=
        "\x1B\x74\x02";


    /*
    ============================================================
    CABEÇALHO
    ============================================================
    */

    cupom +=
        CMD.CENTER;

    cupom +=
        CMD.BOLD_ON;

    cupom +=
        CMD.DOUBLE;

    cupom +=
        "LANCHES MARINI\n";

    cupom +=
        CMD.NORMAL;

    cupom +=
        CMD.BOLD_OFF;

    cupom +=
        linhaDupla() +
        "\n";


    /*
    ============================================================
    PEDIDO
    ============================================================
    */

    cupom +=
        CMD.LEFT;

    cupom +=
        CMD.BOLD_ON;


    cupom += campo(
        "PEDIDO",
        "#" +
            texto(
                pedido.numeroPedido ||
                pedido.id ||
                "-"
            )
    );


    cupom += campo(
        "DATA",
        pedido.dataHora ||
            dataAtual()
    );


    cupom +=
        CMD.BOLD_OFF;

    cupom +=
        linha() +
        "\n";


    /*
    ============================================================
    CLIENTE
    ============================================================
    */

    cupom +=
        CMD.BOLD_ON;


    cupom +=

        `CLIENTE: ${texto(
            pedido.cliente ||
            "Cliente não informado"
        )}\n`;


    cupom +=
        CMD.BOLD_OFF;


    cupom +=

        `Telefone: ${texto(
            pedido.telefone ||
            "-"
        )}\n`;


    if (
        (
            pedido.tipo ||
            ""
        )
            .toUpperCase() ===
        "MESA"
    ) {

        cupom +=

            `Mesa: ${texto(
                pedido.numeroMesa ??
                pedido.mesa ??
                "-"
            )}\n`;

    }


    cupom +=
        linha() +
        "\n";


    /*
    ============================================================
    ITENS
    ============================================================
    */

    cupom +=
        CMD.BOLD_ON;

    cupom +=
        "ITENS DO PEDIDO\n";

    cupom +=
        CMD.BOLD_OFF;


    const itens =

        Array.isArray(
            pedido.itens
        )

            ? pedido.itens

            : [];


    if (!itens.length) {

        cupom +=

            "Nenhum item informado.\n";

    }


    for (
        const item of itens
    ) {

        const quantidade =

            numero(
                item.quantidade ||
                1
            );


        const nome =

            texto(
                item.nome ||
                "Item"
            );


        const valorUnitario =

            numero(

                item.valorUnitario ??

                item.precoBase ??

                item.preco ??

                0

            );


        /*
        Produto e valor.
        */

        const descricao =

            `${quantidade}x ${nome}`;


        if (
            descricao.length +
                dinheiro(
                    valorUnitario
                ).length <
            LARGURA
        ) {

            cupom +=

                duasColunas(
                    descricao,
                    dinheiro(
                        valorUnitario
                    )
                );

            cupom += "\n";

        } else {

            quebrarLinha(
                descricao
            ).forEach(
                (itemLinha) => {

                    cupom +=
                        itemLinha +
                        "\n";

                }
            );


            cupom +=
                CMD.RIGHT;


            cupom +=

                dinheiro(
                    valorUnitario
                ) +
                "\n";


            cupom +=
                CMD.LEFT;

        }


        /*
        ADICIONAIS
        */

        if (
            Array.isArray(
                item.adicionais
            ) &&
            item.adicionais.length
        ) {

            cupom +=
                "  COMPLEMENTOS:\n";


            for (
                const adicional
                of item.adicionais
            ) {

                if (
                    typeof adicional ===
                    "string"
                ) {

                    quebrarLinha(

                        `  + ${adicional}`

                    ).forEach(
                        (adicionalLinha) => {

                            cupom +=
                                adicionalLinha +
                                "\n";

                        }
                    );


                    continue;

                }


                const nomeAdicional =

                    texto(
                        adicional.nome ||
                        "Adicional"
                    );


                const valorAdicional =

                    numero(

                        adicional.preco ??

                        adicional.valor ??

                        0

                    );


                const textoAdicional =

                    `  + ${nomeAdicional}`;


                if (
                    valorAdicional >
                    0
                ) {

                    if (
                        textoAdicional.length +
                            dinheiro(
                                valorAdicional
                            ).length <
                        LARGURA
                    ) {

                        cupom +=

                            duasColunas(
                                textoAdicional,
                                dinheiro(
                                    valorAdicional
                                )
                            );

                        cupom += "\n";

                    } else {

                        quebrarLinha(
                            textoAdicional
                        ).forEach(
                            (adicionalLinha) => {

                                cupom +=
                                    adicionalLinha +
                                    "\n";

                            }
                        );


                        cupom +=
                            `    ${dinheiro(
                                valorAdicional
                            )}\n`;

                    }

                } else {

                    quebrarLinha(
                        textoAdicional
                    ).forEach(
                        (adicionalLinha) => {

                            cupom +=
                                adicionalLinha +
                                "\n";

                        }
                    );

                }

            }

        }


        /*
        OBSERVAÇÃO DO ITEM
        */

        const observacaoItem =

            texto(

                item.observacaoItem ||

                item.personalizados
                    ?.observacao ||

                ""

            ).trim();


        if (
            observacaoItem
        ) {

            cupom +=
                CMD.BOLD_ON;

            cupom +=
                "[ OBSERVACAO ]\n";

            cupom +=
                CMD.BOLD_OFF;


            quebrarLinha(

                observacaoItem
                    .toUpperCase()

            ).forEach(
                (obsLinha) => {

                    cupom +=
                        obsLinha +
                        "\n";

                }
            );

        }


        cupom += "\n";

    }


    cupom +=
        linha() +
        "\n";


    /*
    ============================================================
    ENTREGA / RETIRADA
    ============================================================
    */

    const tipo =

        texto(
            pedido.tipo
        ).toUpperCase();


    if (
        tipo ===
        "DELIVERY"
    ) {

        cupom +=
            CMD.BOLD_ON;

        cupom +=
            "ENTREGA\n";

        cupom +=
            CMD.BOLD_OFF;


        const endereco =
            pedido.endereco;


        if (
            endereco
        ) {

            /*
            Endereço em destaque.

            Como DOUBLE dobra a largura,
            a quebra precisa usar
            metade das colunas.
            */

            cupom +=
                CMD.DOUBLE;


            cupom +=
                "ENDERECO:\n";


            if (
                typeof endereco ===
                "object"
            ) {

                const rua =

                    texto(
                        endereco.rua
                    );


                const numeroCasa =

                    texto(
                        endereco.numero
                    );


                let linhaEndereco =
                    rua;


                if (
                    numeroCasa
                ) {

                    linhaEndereco +=

                        `${linhaEndereco
                            ? ", "
                            : ""}${numeroCasa}`;

                }


                quebrarLinha(
                    linhaEndereco,
                    LARGURA_DUPLA
                ).forEach(
                    (endLinha) => {

                        cupom +=
                            endLinha +
                            "\n";

                    }
                );


                if (
                    endereco.bairro
                ) {

                    quebrarLinha(

                        texto(
                            endereco.bairro
                        ),

                        LARGURA_DUPLA

                    ).forEach(
                        (bairroLinha) => {

                            cupom +=
                                bairroLinha +
                                "\n";

                        }
                    );

                }


                if (
                    endereco.complemento
                ) {

                    quebrarLinha(

                        `Compl: ${endereco.complemento}`,

                        LARGURA_DUPLA

                    ).forEach(
                        (complLinha) => {

                            cupom +=
                                complLinha +
                                "\n";

                        }
                    );

                }


                if (
                    endereco.cep
                ) {

                    quebrarLinha(

                        `CEP: ${endereco.cep}`,

                        LARGURA_DUPLA

                    ).forEach(
                        (cepLinha) => {

                            cupom +=
                                cepLinha +
                                "\n";

                        }
                    );

                }

            } else {

                quebrarLinha(

                    endereco,

                    LARGURA_DUPLA

                ).forEach(
                    (endLinha) => {

                        cupom +=
                            endLinha +
                            "\n";

                    }
                );

            }


            cupom +=
                CMD.NORMAL;

        }


        if (
            pedido.referencia
        ) {

            cupom +=

                `Referencia: ${texto(
                    pedido.referencia
                )}\n`;

        }

    } else {

        cupom +=
            CMD.BOLD_ON;


        cupom +=

            `TIPO: ${
                texto(
                    pedido.tipo
                ) || "-"
            }\n`;


        cupom +=
            CMD.BOLD_OFF;

    }


    /*
    ============================================================
    OBSERVAÇÕES GERAIS
    ============================================================
    */

    if (
        pedido.observacoes
    ) {

        cupom +=
            linha() +
            "\n";


        cupom +=
            CMD.BOLD_ON;

        cupom +=
            "OBSERVACOES\n";

        cupom +=
            CMD.BOLD_OFF;


        quebrarLinha(

            texto(
                pedido.observacoes
            ).toUpperCase()

        ).forEach(
            (obsLinha) => {

                cupom +=
                    obsLinha +
                    "\n";

            }
        );

    }


    cupom +=
        linha() +
        "\n";


    /*
    ============================================================
    PAGAMENTO
    ============================================================
    */

    const pagamento =

        texto(
            pedido.pagamentoMetodo
        ) || "-";


    cupom +=
        CMD.BOLD_ON;


    cupom +=

        `PAGAMENTO: ${pagamento}\n`;


    cupom +=
        CMD.BOLD_OFF;


    /*
    TROCO
    */

    if (
        pagamento.toUpperCase() ===
        "DINHEIRO"
    ) {

        const totalPedido =

            numero(
                pedido.valorTotal
            );


        if (

            pedido.trocoPara !==
                null &&

            pedido.trocoPara !==
                undefined &&

            pedido.trocoPara !==
                ""

        ) {

            const pago =

                numero(
                    pedido.trocoPara
                );


            const troco =

                Math.max(
                    0,
                    pago -
                        totalPedido
                );


            cupom +=

                `CLIENTE PAGA: ${dinheiro(
                    pago
                )}\n`;


            cupom +=

                `TROCO: ${dinheiro(
                    troco
                )}\n`;

        } else {

            cupom +=

                "TROCO: Cliente possui trocado.\n";

        }

    }


    cupom +=
        linha() +
        "\n";


    /*
    ============================================================
    VALORES
    ============================================================
    */

    cupom +=

        duasColunas(

            "Subtotal",

            dinheiro(
                pedido.valorSubtotal
            )

        ) +
        "\n";


    if (
        tipo ===
        "DELIVERY"
    ) {

        cupom +=

            duasColunas(

                "Entrega",

                dinheiro(
                    pedido.taxaEntrega
                )

            ) +
            "\n";

    }


    cupom += "\n";


    /*
    ============================================================
    TOTAL
    ============================================================
    */

    cupom +=
        CMD.CENTER;

    cupom +=
        CMD.BOLD_ON;

    cupom +=
        CMD.DOUBLE;


    cupom +=

        `TOTAL: ${dinheiro(
            pedido.valorTotal
        )}\n`;


    cupom +=
        CMD.NORMAL;

    cupom +=
        CMD.BOLD_OFF;


    /*
    ============================================================
    RODAPÉ
    ============================================================
    */

    cupom += "\n";

    cupom +=
        "Obrigado pela preferencia!\n";

    cupom +=
        "\n\n\n";


    /*
    Corte automático.
    */

    cupom +=
        CMD.CUT;


    /*
    ============================================================
    ENVIAR
    ============================================================
    */

    await enviarRAW(
        cupom
    );


    estado.impressosHoje++;

    estado.ultimaImpressao =
        new Date().toISOString();

}


/*
|--------------------------------------------------------------------------
| TESTE RAW
|--------------------------------------------------------------------------
*/

app.post(
    "/print/raw-test",

    async (
        req,
        res
    ) => {

        try {

            let teste = "";

            teste +=
                CMD.RESET;

            teste +=
                "\x1B\x74\x02";

            teste +=
                CMD.CENTER;

            teste +=
                CMD.BOLD_ON;

            teste +=
                CMD.DOUBLE;

            teste +=
                "TESTE ELGIN i9\n";

            teste +=
                CMD.NORMAL;

            teste +=
                CMD.BOLD_OFF;

            teste +=
                "\n";

            teste +=
                "Impressora detectada automaticamente.\n";

            teste +=
                "\n\n\n";

            teste +=
                CMD.CUT;


            await enviarRAW(
                teste
            );


            res.json({

                success: true,

                message:
                    "RAW enviado."

            });

        } catch (erro) {

            console.error(
                erro
            );


            res.status(500)
                .json({

                    success:
                        false,

                    message:
                        erro.message

                });

        }

    }

);


/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

app.get(
    "/status",

    async (
        req,
        res
    ) => {

        const online =

            await verificarImpressora();


        res.json({

            success: true,

            online,

            impressora:
                estado.impressora,

            fila:
                estado.fila,

            impressosHoje:
                estado.impressosHoje,

            ultimaImpressao:
                estado.ultimaImpressao

        });

    }

);


/*
|--------------------------------------------------------------------------
| IMPRESSÃO DE TESTE
|--------------------------------------------------------------------------
*/

app.post(
    "/print/test",

    async (
        req,
        res
    ) => {

        try {

            const pedidoFake = {

                id:
                    "TESTE-001",

                numeroPedido:
                    "271385",

                cliente:
                    "João José da Silva Ávila",

                telefone:
                    "(19) 99999-9999",

                telefoneWhatsapp:
                    "5519999999999",

                tipo:
                    "Delivery",

                status:
                    "RECEBIDO",

                endereco: {

                    cep:
                        "13360-000",

                    bairro:
                        "São José",

                    rua:
                        "Rua João Dias da Silva",

                    numero:
                        "203",

                    complemento:
                        "Casa azul"

                },

                referencia:
                    "Próxima à padaria",

                observacoes:
                    "Sem cebola, sem pimentão, atenção à entrega rápida",

                pagamentoMetodo:
                    "PIX",

                pagamentoStatus:
                    "PENDENTE",

                trocoPara:
                    null,

                taxaEntrega:
                    8,

                valorSubtotal:
                    39.90,

                valorTotal:
                    47.90,

                itens: [

                    {

                        nome:
                            "X-Búrguer Especial com Queijo",

                        quantidade:
                            2,

                        valorUnitario:
                            19.95,

                        subtotal:
                            39.90,

                        adicionais: [

                            {

                                nome:
                                    "Hambúrguer Grande",

                                valor:
                                    5

                            },

                            {

                                nome:
                                    "Queijo Muçarela",

                                valor:
                                    3

                            }

                        ],

                        observacaoItem:
                            "Sem tomate e sem cebola"

                    },

                    {

                        nome:
                            "Coca-Cola 2L Gelada",

                        quantidade:
                            1,

                        valorUnitario:
                            5.90,

                        subtotal:
                            5.90,

                        adicionais:
                            [],

                        observacaoItem:
                            "Entregar bem gelada"

                    }

                ]

            };


            estado.fila++;


            await imprimirPedido(
                pedidoFake
            );


            estado.fila =

                Math.max(
                    0,
                    estado.fila - 1
                );


            res.json({

                success: true,

                message:
                    "Impressão de teste enviada.",

                impressora:
                    estado.impressora

            });

        } catch (erro) {

            estado.fila =

                Math.max(
                    0,
                    estado.fila - 1
                );


            console.error(
                "[PRINT TEST]",
                erro
            );


            res.status(500)
                .json({

                    success:
                        false,

                    message:
                        erro.message

                });

        }

    }

);


/*
|--------------------------------------------------------------------------
| IMPRIMIR PEDIDO
|--------------------------------------------------------------------------
*/

app.post(
    "/print/order",

    async (
        req,
        res
    ) => {

        console.log(
            "=============================="
        );

        console.log(
            "PEDIDO RECEBIDO:"
        );

        console.log(

            JSON.stringify(
                req.body,
                null,
                2
            )

        );

        console.log(
            "=============================="
        );


        try {

            const pedido =
                req.body || {};


            estado.fila++;


            await imprimirPedido(
                pedido
            );


            estado.fila =

                Math.max(
                    0,
                    estado.fila - 1
                );


            res.json({

                success: true,

                message:
                    "Pedido impresso com sucesso.",

                impressora:
                    estado.impressora

            });

        } catch (erro) {

            estado.fila =

                Math.max(
                    0,
                    estado.fila - 1
                );


            console.error(
                "Erro ao imprimir pedido:"
            );

            console.error(
                erro
            );


            res.status(500)
                .json({

                    success:
                        false,

                    message:
                        erro.message

                });

        }

    }

);


/*
|--------------------------------------------------------------------------
| LIMPAR FILA
|--------------------------------------------------------------------------
*/

app.post(
    "/queue/clear",

    (
        req,
        res
    ) => {

        estado.fila = 0;


        res.json({

            success: true,

            message:
                "Fila limpa."

        });

    }

);


/*
|--------------------------------------------------------------------------
| INICIALIZAÇÃO
|--------------------------------------------------------------------------
*/

console.log(
    "======================================"
);

console.log(
    " MESA FACIL - ESC/POS RAW"
);

console.log(
    "======================================"
);


app.listen(
    PORT,

    async () => {

        console.log(
            `Servidor: http://localhost:${PORT}`
        );


        const online =

            await verificarImpressora();


        console.log(
            ""
        );


        console.log(
            "======================================"
        );


        if (online) {

            console.log(
                `Impressora: ${estado.impressora}`
            );

            console.log(
                "Status: ONLINE"
            );

        } else {

            console.log(
                "Impressora: nenhuma ELGIN detectada"
            );

            console.log(
                "Status: OFFLINE"
            );

        }


        console.log(
            "======================================"
        );

        console.log(
            ""
        );

    }

);