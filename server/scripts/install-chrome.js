const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const VERSION = "146.0.7680.31";

const SERVER_DIR = path.resolve(__dirname, "..");
const PUPPETEER_DIR = path.join(SERVER_DIR, ".puppeteer");
const CHROME_DIR = path.join(PUPPETEER_DIR, "chrome-win64");
const CHROME_EXE = path.join(CHROME_DIR, "chrome.exe");

const ZIP_URL =
    `https://storage.googleapis.com/chrome-for-testing-public/${VERSION}/win64/chrome-win64.zip`;

const ZIP_PATH = path.join(PUPPETEER_DIR, "chrome-win64.zip");
const TEMP_DIR = path.join(PUPPETEER_DIR, "_extract");

function log(message) {
    console.log(`[CHROME] ${message}`);
}

function runPowerShell(args) {
    execFileSync(
        "powershell.exe",
        [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            args
        ],
        {
            stdio: "inherit"
        }
    );
}

function removeIfExists(target) {
    if (fs.existsSync(target)) {
        fs.rmSync(target, {
            recursive: true,
            force: true
        });
    }
}

async function main() {
    if (process.platform !== "win32") {
        log("Sistema não é Windows. Instalação ignorada.");
        return;
    }

    if (fs.existsSync(CHROME_EXE)) {
        log("Chrome for Testing já está instalado.");
        log(CHROME_EXE);
        return;
    }

    fs.mkdirSync(PUPPETEER_DIR, { recursive: true });

    if (!fs.existsSync(ZIP_PATH)) {
        log(`Baixando Chrome for Testing ${VERSION}...`);

        const command =
            `Invoke-WebRequest -Uri '${ZIP_URL}' -OutFile '${ZIP_PATH}'`;

        runPowerShell(command);

        log("Download concluído.");
    } else {
        log("Download já existe. Reutilizando ZIP.");
    }

    removeIfExists(TEMP_DIR);

    fs.mkdirSync(TEMP_DIR, { recursive: true });

    log("Extraindo Chrome for Testing...");

    const extractCommand =
        `Expand-Archive -LiteralPath '${ZIP_PATH}' -DestinationPath '${TEMP_DIR}' -Force`;

    runPowerShell(extractCommand);

    const extractedDir = path.join(TEMP_DIR, "chrome-win64");
    const extractedExe = path.join(extractedDir, "chrome.exe");

    if (!fs.existsSync(extractedExe)) {
        throw new Error(
            `chrome.exe não foi encontrado após a extração: ${extractedExe}`
        );
    }

    removeIfExists(CHROME_DIR);

    fs.renameSync(extractedDir, CHROME_DIR);

    removeIfExists(TEMP_DIR);
    removeIfExists(ZIP_PATH);

    if (!fs.existsSync(CHROME_EXE)) {
        throw new Error("Chrome for Testing não foi instalado corretamente.");
    }

    const files = countFiles(CHROME_DIR);

    log(`Chrome for Testing instalado com sucesso.`);
    log(`Executável: ${CHROME_EXE}`);
    log(`Arquivos instalados: ${files}`);
}

function countFiles(directory) {
    let total = 0;

    for (const entry of fs.readdirSync(directory, {
        withFileTypes: true
    })) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            total += countFiles(fullPath);
        } else {
            total++;
        }
    }

    return total;
}

main().catch((error) => {
    console.error("[CHROME] ERRO:", error);
    process.exit(1);
});