const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");

const VERSION = "146.0.7680.31";

const SERVER_DIR = path.resolve(__dirname, "..");
const PUPPETEER_DIR = path.join(SERVER_DIR, ".puppeteer");

const CHROME_DIR = path.join(
    PUPPETEER_DIR,
    "chrome-win64"
);

const CHROME_EXE = path.join(
    CHROME_DIR,
    "chrome.exe"
);

const ZIP_URL =
    `https://storage.googleapis.com/chrome-for-testing-public/${VERSION}/win64/chrome-win64.zip`;

const ZIP_PATH = path.join(
    PUPPETEER_DIR,
    "chrome-win64.zip"
);

const TEMP_DIR = path.join(
    PUPPETEER_DIR,
    "_extract"
);

function log(message) {
    console.log(`[CHROME] ${message}`);
}

function removeIfExists(target) {
    if (!fs.existsSync(target)) {
        return;
    }

    fs.rmSync(target, {
        recursive: true,
        force: true
    });
}

function countFiles(directory) {
    let total = 0;

    for (const entry of fs.readdirSync(directory, {
        withFileTypes: true
    })) {
        const fullPath = path.join(
            directory,
            entry.name
        );

        if (entry.isDirectory()) {
            total += countFiles(fullPath);
        } else {
            total++;
        }
    }

    return total;
}

function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(
            destination
        );

        const request = https.get(
            url,
            {
                headers: {
                    "User-Agent":
                        "MesaFacil-Chrome-Installer"
                }
            },
            (response) => {

                if (
                    response.statusCode >= 300 &&
                    response.statusCode < 400 &&
                    response.headers.location
                ) {
                    file.close();

                    try {
                        fs.unlinkSync(destination);
                    } catch {}

                    return downloadFile(
                        response.headers.location,
                        destination
                    )
                        .then(resolve)
                        .catch(reject);
                }

                if (
                    response.statusCode !== 200
                ) {
                    file.close();

                    try {
                        fs.unlinkSync(destination);
                    } catch {}

                    reject(
                        new Error(
                            `HTTP ${response.statusCode} ao baixar Chrome.`
                        )
                    );

                    return;
                }

                const total =
                    Number(
                        response.headers[
                            "content-length"
                        ]
                    ) || 0;

                let received = 0;
                let lastPercent = -1;

                response.on(
                    "data",
                    (chunk) => {
                        received += chunk.length;

                        if (total > 0) {
                            const percent =
                                Math.floor(
                                    (received /
                                        total) *
                                        100
                                );

                            if (
                                percent !==
                                lastPercent
                            ) {
                                lastPercent =
                                    percent;

                                process.stdout.write(
                                    `\r[CHROME] Download: ${percent}%`
                                );
                            }
                        }
                    }
                );

                response.pipe(file);

                file.on(
                    "finish",
                    () => {
                        file.close(() => {
                            process.stdout.write(
                                "\n"
                            );

                            resolve();
                        });
                    }
                );

                file.on(
                    "error",
                    (error) => {
                        try {
                            fs.unlinkSync(
                                destination
                            );
                        } catch {}

                        reject(error);
                    }
                );
            }
        );

        request.on(
            "error",
            (error) => {
                file.close();

                try {
                    fs.unlinkSync(
                        destination
                    );
                } catch {}

                reject(error);
            }
        );
    });
}

function validateZip() {
    if (!fs.existsSync(ZIP_PATH)) {
        return false;
    }

    const stats =
        fs.statSync(ZIP_PATH);

    /*
     * Um ZIP do Chrome for Testing dessa versão
     * possui aproximadamente 191 MB.
     *
     * Se o arquivo estiver muito pequeno,
     * claramente não é um download completo.
     */
    if (
        stats.size <
        100 * 1024 * 1024
    ) {
        return false;
    }

    /*
     * Usa o PowerShell apenas para validar
     * e extrair o ZIP. O download em si é feito
     * diretamente pelo Node.
     */
    try {
        execFileSync(
            "powershell.exe",
            [
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                `
                Add-Type -AssemblyName System.IO.Compression.FileSystem;
                $zip = [System.IO.Compression.ZipFile]::OpenRead('${ZIP_PATH.replace(/'/g, "''")}');
                $zip.Dispose();
                `
            ],
            {
                stdio: "ignore"
            }
        );

        return true;
    } catch {
        return false;
    }
}

function extractZip() {
    removeIfExists(TEMP_DIR);

    fs.mkdirSync(
        TEMP_DIR,
        {
            recursive: true
        }
    );

    log("Extraindo Chrome for Testing...");

    try {
        execFileSync(
            "powershell.exe",
            [
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                `
                Add-Type -AssemblyName System.IO.Compression.FileSystem;
                [System.IO.Compression.ZipFile]::ExtractToDirectory(
                    '${ZIP_PATH.replace(/'/g, "''")}',
                    '${TEMP_DIR.replace(/'/g, "''")}'
                );
                `
            ],
            {
                stdio: "inherit"
            }
        );
    } catch (error) {
        throw new Error(
            `Falha ao extrair o Chrome: ${error.message}`
        );
    }
}

async function main() {

    if (
        process.platform !==
        "win32"
    ) {
        log(
            "Sistema não é Windows. Instalação ignorada."
        );

        return;
    }

    if (
        fs.existsSync(CHROME_EXE)
    ) {
        log(
            "Chrome for Testing já está instalado."
        );

        log(
            `Executável: ${CHROME_EXE}`
        );

        return;
    }

    fs.mkdirSync(
        PUPPETEER_DIR,
        {
            recursive: true
        }
    );

    /*
     * Se existir um ZIP inválido,
     * ele é removido automaticamente.
     */
    if (
        fs.existsSync(ZIP_PATH)
    ) {

        log(
            "Verificando ZIP existente..."
        );

        if (
            !validateZip()
        ) {

            log(
                "ZIP existente está inválido ou incompleto."
            );

            log(
                "Removendo ZIP corrompido..."
            );

            removeIfExists(
                ZIP_PATH
            );
        }
    }

    /*
     * Download
     */
    if (
        !fs.existsSync(ZIP_PATH)
    ) {

        log(
            `Baixando Chrome for Testing ${VERSION}...`
        );

        await downloadFile(
            ZIP_URL,
            ZIP_PATH
        );

        log(
            "Download concluído."
        );

        if (
            !validateZip()
        ) {

            removeIfExists(
                ZIP_PATH
            );

            throw new Error(
                "O ZIP baixado está inválido ou incompleto."
            );
        }
    }

    /*
     * Extração
     */
    extractZip();

    const extractedDir =
        path.join(
            TEMP_DIR,
            "chrome-win64"
        );

    const extractedExe =
        path.join(
            extractedDir,
            "chrome.exe"
        );

    if (
        !fs.existsSync(
            extractedExe
        )
    ) {

        removeIfExists(
            TEMP_DIR
        );

        throw new Error(
            `chrome.exe não foi encontrado após a extração: ${extractedExe}`
        );
    }

    /*
     * Instalação definitiva
     */
    removeIfExists(
        CHROME_DIR
    );

    fs.renameSync(
        extractedDir,
        CHROME_DIR
    );

    removeIfExists(
        TEMP_DIR
    );

    removeIfExists(
        ZIP_PATH
    );

    if (
        !fs.existsSync(
            CHROME_EXE
        )
    ) {

        throw new Error(
            "Chrome for Testing não foi instalado corretamente."
        );
    }

    const files =
        countFiles(
            CHROME_DIR
        );

    log(
        "Chrome for Testing instalado com sucesso."
    );

    log(
        `Executável: ${CHROME_EXE}`
    );

    log(
        `Arquivos instalados: ${files}`
    );
}

main().catch(
    (error) => {

        console.error(
            "[CHROME] ERRO:",
            error
        );

        process.exit(1);
    }
);