import { db } from "./firebase.js";

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";



const beeRef = doc(
    db,
    "integracoes",
    "beeDelivery"
);



/*
==========================================
 BUSCAR CONFIGURAÇÃO BEE DELIVERY
==========================================
*/

export async function buscarConfiguracaoBee(){

    const snap = await getDoc(
        beeRef
    );


    if(!snap.exists()){

        return {

            ativo:false,

            ambiente:"teste",

            token:"",

            entregador:{

                status:"offline",

                nome:"",

                telefone:"",

                id:""

            }

        };

    }


    return snap.data();

}



/*
==========================================
 SALVAR CONFIGURAÇÃO BEE DELIVERY
==========================================
*/

export async function salvarConfiguracaoBee(dados){

    const atual = await buscarConfiguracaoBee();


    await setDoc(

        beeRef,

        {

            ativo:
            dados.ativo ?? atual.ativo,


            ambiente:
            dados.ambiente ?? atual.ambiente,


            token:
            dados.token ?? atual.token,


            entregador:
            dados.entregador ?? atual.entregador,


            atualizadoEm:
            serverTimestamp()

        },

        {
            merge:true
        }

    );


    return true;

}



/*
==========================================
 SOLICITAR ENTREGADOR
==========================================
*/

export async function solicitarEntregador(pedido){


    const configuracao =
    await buscarConfiguracaoBee();



    if(!configuracao.ativo){

        throw new Error(
            "Bee Delivery desativado"
        );

    }



    const payload = {


        pedidoId:
        pedido.id,



        cliente:{

            nome:
            pedido.cliente || "",


            telefone:
            pedido.telefoneWhatsapp ||
            pedido.telefone ||
            ""

        },



        endereco:{


            rua:
            pedido.endereco?.rua || "",


            numero:
            pedido.endereco?.numero || "",


            bairro:
            pedido.endereco?.bairro ||
            pedido.bairro ||
            "",


            complemento:
            pedido.endereco?.complemento ||
            ""

        },



        itens:

        (pedido.itens || [])
        .map(item => ({

            nome:
            item.nome,


            quantidade:
            item.quantidade,


            valor:
            Number(
                item.valorUnitario || 0
            )

        })),



        valor:

        Number(
            pedido.valorTotal || 0
        )

    };



    /*
        FUTURA API BEE DELIVERY

        POST
        XXX

        Headers:

        Authorization:
        Bearer TOKEN


        Body:
        payload

    */


    console.log(
        "[BEE] Payload entrega:",
        payload
    );



    /*
        MOCK TEMPORÁRIO
    */


    return {


        success:true,


        message:
        "Solicitação enviada para Bee Delivery",



        entregador:{


            status:
            "procurando",


            id:
            "",


            nome:
            "",


            telefone:
            ""

        },


        payload

    };


}



/*
==========================================
 CONSULTAR STATUS ENTREGADOR
==========================================
*/

export async function consultarStatusEntregador(pedidoId){


    /*
        FUTURA API BEE DELIVERY

        endpoint:
        XXX

    */


    console.log(
        "[BEE MOCK] Consultar status",
        pedidoId
    );


    return {

        success:true,


        integracao:

        {

            status:
            "conectado"

        },


        entregador:{

            status:
            "procurando",

            nome:"",

            telefone:"",

            id:""

        }

    };


}