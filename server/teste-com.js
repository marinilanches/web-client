const { SerialPort } = require("serialport");


const port = new SerialPort({
    path: "COM3",
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
});


port.on("open", () => {

    console.log("COM3 aberta");

    const ESC = "\x1B";
    const GS = "\x1D";


    let comando = "";

    // centralizar
    comando += ESC + "a" + "\x01";

    comando += "TESTE ELGIN i9\n";
    comando += "================\n";

    comando += "Node.js COM3\n\n";


    // corte parcial
    comando += GS + "V" + "\x01";


    port.write(comando, (err)=>{

        if(err){
            console.error("Erro:",err);
        }
        else{
            console.log("Enviado!");
        }

        port.close();

    });

});


port.on("error",(err)=>{
    console.error("Erro porta:",err.message);
});