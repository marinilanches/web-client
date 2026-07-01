import { abrirModal, fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

console.log("mesas.js carregado");

const btnNovaMesa = document.getElementById("novaMesa");

btnNovaMesa.onclick = () => {

    abrirModal(
        "Nova Mesa",
        `
        <form id="formNovaMesa" class="form-grid">

            <div class="form-group">

                <label>Número da Mesa</label>

                <input
                    type="number"
                    id="numeroMesa"
                    required>

            </div>

            <div class="form-group">

                <label>Capacidade</label>

                <input
                    type="number"
                    id="capacidadeMesa"
                    value="4"
                    required>

            </div>

            <div class="form-group">

                <label>Status</label>

                <select id="statusMesa">

                    <option value="LIVRE">Livre</option>
                    <option value="RESERVADA">Reservada</option>
                    <option value="MANUTENCAO">Manutenção</option>

                </select>

            </div>

            <div class="modal-actions">

                <button
                    type="button"
                    id="cancelarMesa"
                    class="btn btn-secondary">

                    Cancelar

                </button>

                <button
                    type="submit"
                    class="btn btn-primary">

                    Salvar Mesa

                </button>

            </div>

        </form>
        `
    );

    document
        .getElementById("cancelarMesa")
        .addEventListener("click", fecharModal);

    document
        .getElementById("formNovaMesa")
        .addEventListener("submit", (e) => {

            e.preventDefault();

            toast("Mesa criada com sucesso!");

            fecharModal();

        });

};