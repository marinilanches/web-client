app.get("/api/address/reverse", async (req, res) => {

    try {

        const {
            lat,
            lon
        } = req.query;


        const resposta = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`,
            {
                headers:{
                    "User-Agent":"MesaFacil/1.0"
                }
            }
        );


        const dados = await resposta.json();


        res.json(dados);


    } catch(error){

        console.error(
            "[ADDRESS]",
            error
        );

        res.status(500).json({
            erro:true
        });

    }

});