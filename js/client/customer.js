import {
  buscarCliente,
  salvarCliente
} from "../services/customers.js";


export async function iniciarCliente(){

    const cliente = await buscarCliente();


    if(cliente){

        preencherCampos(cliente);

    }


    const btn =
      document.getElementById(
        "salvarClienteBtn"
      );


    if(btn){

        btn.addEventListener(
          "click",
          salvarDadosCliente
        );

    }

}



async function salvarDadosCliente(){


const nome =
document.getElementById("clienteNome")?.value;


const telefone =
document.getElementById("clienteTelefone")?.value;



if(!nome || !telefone){

alert(
"Informe nome e telefone"
);

return;

}



const btn = document.getElementById("salvarClienteBtn");

btn.disabled = true;
btn.textContent = "Salvando...";

try {

    await salvarCliente({
        nome,
        telefone
    });

    alert("Dados salvos!");

} finally {

    btn.disabled = false;
    btn.textContent = "Salvar";

}


alert(
"Dados salvos!"
);



fecharModalCliente();

}




function preencherCampos(cliente){


const nome =
document.getElementById("clienteNome");


const telefone =
document.getElementById("clienteTelefone");



if(nome)
nome.value =
cliente.nome || "";



if(telefone)
telefone.value =
cliente.telefone || "";


}



function fecharModalCliente(){

const modal =
document.getElementById(
"clienteModal"
);


if(modal){

const instance =
bootstrap.Modal.getInstance(modal);


instance?.hide();

}

}