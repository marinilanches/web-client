const fs = require("fs");

const ESC = "\x1B";
const GS = "\x1D";

let teste = "";

teste += ESC + "@";

teste += "TESTE ACENTOS\n\n";

teste += "UTF8:\n";
teste += "á é í ó ú ç ã õ ê ô\n\n";

teste += "PORTUGUES:\n";
teste += "ação coração pão maçã\n\n";

teste += GS + "V\x01";


fs.writeFileSync(
    "teste.raw",
    Buffer.from(teste,"latin1")
);

console.log("gerado");