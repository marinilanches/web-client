import { db } from "../../../js/services/firebase.js";

import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const REF = doc(
  db,
  "configuracoes",
  "geral"
);



const lista = document.getElementById(
  "listaDistancias"
);

const btnSalvar = document.getElementById(
  "btnSalvar"
);

const btnAdicionarDistancia = document.getElementById(
  "btnAdicionarDistancia"
);


const tempoEntrega = document.getElementById(
  "tempoEntrega"
);

const raioMaximo = document.getElementById(
  "raioMaximo"
);



let faixas = [

  {
    limiteKm: 0.5,
    taxa: 9
  },

  {
    limiteKm: 1,
    taxa: 9
  },

  {
    limiteKm: 1.5,
    taxa: 9
  },

  {
    limiteKm: 2,
    taxa: 9
  },

  {
    limiteKm: 2.5,
    taxa: 10
  },

  {
    limiteKm: 3,
    taxa: 10
  },

  {
    limiteKm: 3.5,
    taxa: 11
  },

  {
    limiteKm: 4,
    taxa: 11
  },

  {
    limiteKm: 5,
    taxa: 13
  },

  {
    limiteKm: 6,
    taxa: 14
  },

  {
    limiteKm: 7,
    taxa: 17
  }

];



function renderizar() {

  lista.innerHTML = "";


  faixas.forEach((item, index) => {


    lista.innerHTML += `

    <tr>

      <td>
        Até ${Number(item.limiteKm).toString()} km
      </td>


      <td>

        ${tempoEntrega.value}
        min

      </td>


      <td>

        <input
          type="number"
          value="${item.taxa}"
          data-index="${index}"
          class="inputTaxa"
        >

      </td>


      <td>

        <button
          type="button"
          class="btn btn-danger btnRemoverDistancia"
          data-index="${index}"
        >
          🗑
        </button>

      </td>


    </tr>

    `;


  });


  document
    .querySelectorAll(".btnRemoverDistancia")
    .forEach(botao => {

      botao.addEventListener(
        "click",
        () => {

          const index =
            Number(botao.dataset.index);


          faixas.splice(
            index,
            1
          );


          renderizar();

        }
      );

    });


}



async function carregar() {


  const snap = await getDoc(REF);


  if (
    snap.exists()
  ) {

    const dados = snap.data();


    const entrega =
      dados.delivery?.configuracaoEntrega;


    if (entrega) {

      tempoEntrega.value =
        entrega.tempo || 50;


      raioMaximo.value =
        entrega.raio || 7;


      faixas =
        (entrega.faixas || faixas)
          .map((item) => ({
            limiteKm:
              item.limiteKm ?? item.distancia,

            taxa:
              item.taxa
          }))
          .filter(
            (item, index, array) =>
              array.findIndex(
                (f) => f.limiteKm === item.limiteKm
              ) === index
          );

    }


  }


  renderizar();


}



async function salvar() {


  document
    .querySelectorAll(".inputTaxa")
    .forEach(input => {


      const index =
        Number(input.dataset.index);


      faixas[index].taxa =
        Number(input.value);



    });



  await setDoc(
    REF,
    {

      delivery: {


        configuracaoEntrega: {


          tempo:
            Number(
              tempoEntrega.value
            ),


          raio:
            Number(
              raioMaximo.value
            ),


          faixas


        }


      }

    },

    {
      merge: true
    }

  );


  alert(
    "Configuração salva!"
  );

}

btnAdicionarDistancia.addEventListener(
  "click",
  () => {

    const distancia = prompt(
      "Distância em km:"
    );


    if (!distancia) return;


    const taxa = prompt(
      "Valor da taxa:"
    );


    if (!taxa) return;


    faixas.push({

      limiteKm:
        Number(distancia),

      taxa:
        Number(taxa)

    });


    faixas.sort(
      (a, b) =>
        a.limiteKm - b.limiteKm
    );


    renderizar();

  }
);



btnSalvar.addEventListener(
  "click",
  salvar
);



carregar();