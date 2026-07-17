const axios = require("axios");

const config = require("./bee.config");


async function beeRequest(endpoint, data = {}) {

    try {

        const response = await axios.post(
            `${config.API_URL}${endpoint}`,
            data,
            {
                headers:{
                    Authorization:`Bearer ${config.TOKEN}`,
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