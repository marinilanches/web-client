export function toast(mensagem,tipo="success"){

    const toast=document.createElement("div");

    toast.className=`toast toast-${tipo}`;

    toast.innerHTML=`

        ${mensagem}

    `;

    document.body.appendChild(toast);

    setTimeout(()=>{

        toast.classList.add("show");

    },50);

    setTimeout(()=>{

        toast.classList.remove("show");

        setTimeout(()=>{

            toast.remove();

        },300);

    },3000);

}