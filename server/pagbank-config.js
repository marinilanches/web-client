/* ==========================================================
   PAGBANK CONFIG
   ESTE ARQUIVO FICA NO SERVIDOR
   NÃO IMPORTAR NO FRONT-END
========================================================== */

const pagbankConfig = {
  environment: "sandbox", // "sandbox" ou "production"

  baseUrl: "https://sandbox.api.pagseguro.com",

  token: "XXX",
  clientId: "XXX",
  clientSecret: "XXX",

  webhookUrl: "XXX",

  seller: {
    name: "XXX",
    email: "XXX",
    taxId: "XXX"
  }
};

module.exports = {
  pagbankConfig
};