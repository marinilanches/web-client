const { getPrinters } = require("pdf-to-printer");

async function teste(){

    const printers = await getPrinters();

    console.log(printers);

}

teste();