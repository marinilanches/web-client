const axios = require("axios");
const config = require("./bee.config");


let tokenCache = {
    accessToken: null,
    expiresAt: 0
};



async function obterTokenBee(){


    const agora = Date.now();



    if(
        tokenCache.accessToken &&
        agora < tokenCache.expiresAt
    ){

        return tokenCache.accessToken;

    }



    console.log("[BEE AUTH] Gerando novo token");



    const resposta = await axios.post(

        `${config.API_URL}/api/v1/open-delivery/oauth/token`,

        {

            client_id:
            config.CLIENT_ID,


            client_secret:
            config.CLIENT_SECRET

        },

        {

            headers:{
                "Content-Type":"application/json"
            }

        }

    );



    const dados = resposta.data;



    tokenCache = {

        accessToken:
        dados.accessToken,


        expiresAt:
        agora + ((dados.expiresIn - 60) * 1000)

    };



    return tokenCache.accessToken;

}



module.exports = {
    obterTokenBee
};