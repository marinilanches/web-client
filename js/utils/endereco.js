import {
    buscarEnderecos,
    buscarDetalhesEndereco
} from "../services/address-search.js";


export function normalizarTexto(texto){

    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g,"")
        .toLowerCase()
        .trim();

}


export function iniciarAutocompleteEndereco({

    ruaEl,
    sugestoesEl,
    numeroEl,
    bairroEl,
    bairrosEntrega,
    aoSelecionarBairro

}){


let timeout = null;


function fechar(){

    if(!sugestoesEl) return;

    sugestoesEl.innerHTML="";
    sugestoesEl.style.display="none";

}



function renderizar(lista){


    sugestoesEl.innerHTML="";


    if(!lista.length){

        fechar();
        return;

    }



    lista.forEach(item=>{


        const div=document.createElement("div");


        div.className="autocomplete-item";


        div.innerHTML=`

            <div class="autocomplete-title">
                📍 ${item.rua}
            </div>

            <div class="autocomplete-subtitle">
                ${item.cidade} - ${item.estado}
            </div>

        `;



        div.onclick=async()=>{


            ruaEl.value=item.rua;


            numeroEl.value="";


            try{


                const detalhes =
                    await buscarDetalhesEndereco(
                        item.latitude,
                        item.longitude
                    );



                const bairroEncontrado =
                    bairrosEntrega.find(b=>
                        normalizarTexto(b.nome) ===
                        normalizarTexto(detalhes.bairro)
                    );



                if(bairroEncontrado){

                    bairroEl.value =
                        bairroEncontrado.nome;


                    aoSelecionarBairro(
                        bairroEncontrado
                    );

                }



            }catch(e){

                console.error(
                    "Erro endereço:",
                    e
                );

            }



            fechar();


            numeroEl.focus();


        };


        sugestoesEl.appendChild(div);


    });


    sugestoesEl.style.display="block";


}



ruaEl.addEventListener(
    "input",
    ()=>{


        clearTimeout(timeout);



        timeout=setTimeout(async()=>{


            const texto =
                ruaEl.value.trim();



            if(texto.length < 3){

                fechar();
                return;

            }



            const resultados =
                await buscarEnderecos(texto);



            renderizar(resultados);



        },300);



    }
);



document.addEventListener(
    "pointerdown",
    e=>{


        if(
            !e.target.closest("#"+ruaEl.id) &&
            !e.target.closest("#"+sugestoesEl.id)
        ){

            fechar();

        }


    }
);


}