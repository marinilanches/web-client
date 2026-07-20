const axios = require("axios");

const config = require("./bee.config");
const { obterTokenBee } = require("./bee.auth");


async function beeRequest(endpoint, data = {}) {

    try {

        const token = await obterTokenBee();


        const response = await axios.post(

            `${config.API_URL}${endpoint}`,

            data,

            {
                headers:{
                    Authorization:`Bearer ${token}`,
                    "Content-Type":"application/json"
                }
            }

        );


        return response.data;


    } catch(error){

        console.error(
            "[BEE API]",
            error.response?.data || error.message
        );


        throw error;

    }

}



module.exports = {
    beeRequest
};