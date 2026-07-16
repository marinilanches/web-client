let overlay = null;

export function abrirModal(titulo, conteudo) {

    console.log("Função abrirModal executou");

    if (overlay) overlay.remove();

    overlay = document.createElement("div");

    overlay.className = "modal-overlay";

   overlay.innerHTML = `
        <div class="app-modal-content">

            <div class="app-modal-header">

                <h2>${titulo}</h2>

                <button id="fecharModal">✕</button>

            </div>

            <div class="app-modal-body">

                ${conteudo}

            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    document
        .getElementById("fecharModal")
        .addEventListener("click", fecharModal);

    overlay.addEventListener("click", e=>{

        if(e.target===overlay){

            fecharModal();

        }

    });

}

export function fecharModal(){

    overlay?.remove();

    overlay=null;

}
