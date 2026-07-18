import {
  abrirModal,
  fecharModal
} from "./modal.js";


import {
  toast
} from "./toast.js";


import {
  atualizarEntregadorPedido
} from "../../js/services/orders.js";


import {
  solicitarEntregador
} from "../../js/services/bee-delivery.js";



export function abrirDetalhesPedido(pedido){


  if(!pedido){

    toast(
      "Pedido não encontrado"
    );

    return;

  }





  const itensHTML =

  (pedido.itens || [])

  .map(item=>{


    const adicionais =

    (item.adicionais || [])

    .map(

      adicional =>

      `${adicional.nome} (+R$ ${Number(
        adicional.preco || 0
      ).toFixed(2)})`

    )

    .join("<br>");




    return `

      <div class="item-pedido">


        <strong>

          ${item.nome || "-"}

        </strong>



        <p>

          Quantidade:

          ${item.quantidade || 1}

        </p>




        <p>

          Valor unitário:

          R$

          ${Number(
            item.valorUnitario || 0
          ).toFixed(2)}

        </p>




        ${
          adicionais

          ?

          `

          <p>

            <strong>

              Adicionais:

            </strong>

            <br>

            ${adicionais}

          </p>

          `

          :

          ""

        }






        ${
          item.observacaoItem

          ?

          `

          <p>

            <strong>

              📝 Observação:

            </strong>

            <br>

            ${item.observacaoItem}

          </p>

          `

          :

          ""

        }



        <hr>


      </div>

    `;


  })

  .join("");







  abrirModal(

    `Pedido #${pedido.numeroPedido || "-"}`,



    `

    <div>



      <h3>

        👤 Cliente

      </h3>



      <p>

        ${pedido.cliente || "-"}

      </p>




      <p>

        📞

        ${pedido.telefone || pedido.telefoneWhatsapp || "-"}

      </p>






      <h3>

        📦 Tipo

      </h3>



      <p>

        ${pedido.tipo || "-"}

      </p>






      ${
        pedido.tipo === "Delivery"

        ?

        `

        <h3>

          🚚 Entrega

        </h3>





        ${
          pedido.entrega

          ?

          `

          <h3>

            🚚 Bee Delivery

          </h3>




          <p>

            <strong>

            Status:

            </strong>

            <br>

            ${
              pedido.entrega.statusDescricao ||
              pedido.entrega.status ||
              "-"
            }


          </p>




          <p>

            <strong>

            Código:

            </strong>

            <br>

            ${
              pedido.entrega.id || "-"
            }


          </p>




          <p>

            <strong>

            Previsão:

            </strong>

            <br>


            ${
              pedido.entrega.previsaoMinutos

              ?

              `${pedido.entrega.previsaoMinutos} min`

              :

              "-"

            }


          </p>





          <p>

            <strong>

            Entregador:

            </strong>

            <br>


            ${
              pedido.entrega.entregador?.nome ||
              "-"
            }


          </p>




          <p>

            <strong>

            Telefone:

            </strong>

            <br>


            ${
              pedido.entrega.entregador?.telefone ||
              "-"
            }


          </p>





          ${
            pedido.entrega.trackingUrl

            ?

            `

            <p>

              <a

              href="${pedido.entrega.trackingUrl}"

              target="_blank"

              >

              📍 Acompanhar entrega

              </a>

            </p>

            `

            :

            ""

          }



          `

          :

          ""

        }






        <p>

          <strong>

          Bairro:

          </strong>

          <br>


          ${
            pedido.bairro ||
            "-"
          }


        </p>





        <p>

          <strong>

          CEP:

          </strong>

          <br>


          ${
            pedido.endereco?.cep ||
            "-"
          }


        </p>






        <p>

          <strong>

          Endereço:

          </strong>

          <br>


          ${
            pedido.endereco?.rua ||
            "-"
          }


          ${
            pedido.endereco?.numero

            ?

            `, ${pedido.endereco.numero}`

            :

            ""

          }


        </p>






        <p>

          <strong>

          Referência:

          </strong>

          <br>


          ${
            pedido.endereco?.complemento ||
            pedido.referencia ||
            "—"

          }


        </p>


        `


        :

        ""

      }







      <h3>

        🍔 Itens

      </h3>




      ${
        itensHTML ||
        "Nenhum item"
      }







      <h3>

        💰 Pagamento

      </h3>




      <p>

        Método:

        ${
          pedido.pagamentoMetodo ||
          "-"
        }


      </p>




      <p>

        Status:

        ${
          pedido.pagamentoStatus ||
          "-"
        }


      </p>







      ${
        pedido.pagamentoMetodo === "DINHEIRO"

        ?

        `

        <p>

          <strong>

          Cliente paga:

          </strong>

          <br>

          R$

          ${
            Number(
              pedido.trocoPara || 0
            ).toFixed(2)

          }


        </p>



        <p>

          <strong>

          Troco:

          </strong>

          <br>


          R$

          ${
            (
              Number(pedido.trocoPara || 0)
              -
              Number(pedido.valorTotal || 0)

            ).toFixed(2)

          }


        </p>


        `

        :

        ""

      }







      <h3>

        Total

      </h3>



      <h2>

        R$

        ${
          Number(
            pedido.valorTotal || 0
          ).toFixed(2)

        }


      </h2>






      ${
        pedido.observacoes

        ?

        `

        <h3>

          Observações

        </h3>


        <p>

          ${pedido.observacoes}

        </p>

        `

        :

        ""

      }






      <div class="modal-actions">





      ${
        pedido.tipo === "Delivery" && !pedido.entrega

        ?

        `

        <button

          class="btn btn-secondary"

          id="btnSolicitarEntregador"

        >

          🚚 Solicitar entregador

        </button>


        `

        :

        ""

      }





        <button

          class="btn btn-primary"

          id="btnImprimirComanda"

        >

          🖨️ Imprimir comanda

        </button>



      </div>




    </div>

    `

  );







  document

  .getElementById(
    "btnImprimirComanda"
  )

  ?.addEventListener(

    "click",

    ()=>{

      enviarParaImpressora(
        pedido
      );

    }

  );







  document

  .getElementById(
    "btnSolicitarEntregador"
  )

  ?.addEventListener(

    "click",

    async()=>{


      try{


        const resposta =

        await solicitarEntregador(
          pedido
        );



        if(resposta.success){



          await atualizarEntregadorPedido(

            pedido.id,

            resposta.entrega

          );



          toast(
            "🚚 Entregador solicitado!"
          );



          fecharModal();


        }



      }

      catch(erro){


        console.error(
          erro
        );


        toast(
          "Erro ao solicitar entregador."
        );


      }


    }

  );



}








async function enviarParaImpressora(pedido){


  try{


    const resposta =

    await fetch(
      "http://localhost:3002/print/order",
      {

        method:"POST",

        headers:{

          "Content-Type":
          "application/json"

        },


        body:
        JSON.stringify(
          pedido
        )


      }

    );



    const data =
    await resposta.json();




    if(!data.success){

      throw new Error(
        data.message
      );

    }



    toast(
      "Pedido enviado para impressora"
    );



  }


  catch(erro){


    console.error(
      "Erro impressão:",
      erro
    );


    toast(
      "Erro ao imprimir"
    );


  }


}