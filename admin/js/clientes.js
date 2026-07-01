import { abrirModal, fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

console.log("clientes.js carregado");

const btnNovoCliente = document.getElementById("novoCliente");

btnNovoCliente.onclick = () => {

    abrirModal(
        "Novo Cliente",
        `
        <form id="formNovoCliente">

            <label>Nome</label>
            <input type="text" id="nomeCliente" required>

            <label>Telefone</label>
            <input type="text" id="telefoneCliente">

            <div class="modal-actions">

                <button
                    type="button"
                    id="cancelarCliente"
                    class="btn btn-secondary">

                    Cancelar

                </button>

                <button
                    type="submit"
                    class="btn btn-primary">

                    Salvar

                </button>

            </div>

        </form>
        `
    );

    document
        .getElementById("cancelarCliente")
        .addEventListener("click", fecharModal);

    document
        .getElementById("formNovoCliente")
        .addEventListener("submit", (e) => {

            e.preventDefault();

            toast("Cliente criado!");

            fecharModal();

        });

};