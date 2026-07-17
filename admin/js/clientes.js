import { abrirModal, fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

import {
  ouvirClientes,
  criarCliente,
  editarCliente,
  excluirCliente,
} from "../../js/services/clients.js";

/* ==========================================
   ELEMENTOS
========================================== */

const listaClientes = document.getElementById("listaClientes");
const btnNovoCliente = document.getElementById("novoCliente");
const buscarCliente = document.getElementById("buscarCliente");

/* ==========================================
   ESTADO
========================================== */

let clientesCache = [];

/* ==========================================
   INIT
========================================== */

console.log("clientes.js carregado");

ouvirClientes((clientes) => {
  clientesCache = clientes;

  document.querySelector("#totalClientes").textContent = clientes.length;

  document.querySelector("#clientesVip").textContent = clientes.filter(
    (c) => Number(c.totalPedidos || 0) > 5,
  ).length;

  let pedidos = clientes.reduce((a, b) => a + Number(b.totalPedidos || 0), 0);

  document.querySelector("#totalPedidosClientes").textContent = pedidos;

  let gasto = clientes.reduce((a, b) => a + Number(b.totalGasto || 0), 0);

  document.querySelector("#ticketMedio").textContent =
    "R$ " + (gasto / (clientes.length || 1)).toFixed(2);

  aplicarFiltros();
});

buscarCliente?.addEventListener("input", aplicarFiltros);

/* ==========================================
   FILTROS
========================================== */

function aplicarFiltros() {
  let clientes = [...clientesCache];
  const termo = buscarCliente?.value?.trim().toLowerCase() || "";

  if (termo) {
    clientes = clientes.filter((cliente) => {
      const nome = (cliente.nome || "").toLowerCase();
      const telefone = (cliente.telefone || "").toLowerCase();

      return nome.includes(termo) || telefone.includes(termo);
    });
  }

  renderClientes(clientes);
}

function aplicarMascaraTelefone(input) {
  if (!input) return;

  input.addEventListener("focus", () => {
    if (!input.value.trim()) {
      input.value = "+55 ";
    }
  });

  input.addEventListener("input", () => {
    input.value = formatarTelefone(input.value);
  });

  input.addEventListener("keydown", (e) => {
    if (
      input.selectionStart <= 4 &&
      (e.key === "Backspace" || e.key === "Delete")
    ) {
      e.preventDefault();
    }
  });
}

function formatarTelefone(valor = "") {
  let numeros = valor.replace(/\D/g, "");

  if (numeros.startsWith("55")) {
    numeros = numeros.substring(2);
  }

  numeros = numeros.substring(0, 11);

  let resultado = "+55 ";

  if (numeros.length > 0) {
    resultado += "(" + numeros.substring(0, 2);

    if (numeros.length >= 2) {
      resultado += ")";
    }
  }

  if (numeros.length > 2) {
    resultado += " ";

    if (numeros.length <= 7) {
      resultado += numeros.substring(2);
    } else {
      resultado +=
        numeros.substring(2, 7) +
        "-" +
        numeros.substring(7);
    }
  }

  return resultado;
}

/* ==========================================
   RENDER
========================================== */

function renderClientes(clientes) {
  if (!listaClientes) return;

  if (!clientes.length) {
    listaClientes.innerHTML = `
            <tr>
                <td colspan="7">
                    Nenhum cliente encontrado
                </td>
            </tr>
        `;

    atualizarEstatisticas(clientes);

    return;
  }

  listaClientes.innerHTML = clientes
    .map((cliente) => {
      return `

        <tr>

            <td>
                ${cliente.nome || "-"}
            </td>


            <td>
                ${cliente.telefone || "-"}
            </td>


            <td>
              ${
                cliente.ultimaCompra
                  ? new Date(
                      cliente.ultimaCompra.seconds * 1000,
                    ).toLocaleDateString("pt-BR")
                  : "-"
              }
            </td>


            <td>
                ${cliente.totalPedidos || 0}
            </td>


            <td>
                ${Number(cliente.totalGasto || 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
            </td>


            <td>
                🟢 Ativo
            </td>


            <td>
                <button
                    class="btn btn-primary btn-editar"
                    data-id="${cliente.id}">
                    Editar
                </button>

                <button
                    class="btn btn-danger btn-excluir"
                    data-id="${cliente.id}">
                    Excluir
                </button>
            </td>

        </tr>

        `;
    })
    .join("");

  document.querySelectorAll(".btn-editar").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.dataset.id;

      const cliente = clientesCache.find((c) => c.id === id);

      if (cliente) {
        abrirEditarCliente(cliente);
      }
    });
  });

  atualizarEstatisticas(clientes);

  document.querySelectorAll(".btn-excluir").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.dataset.id;

      const confirmar = confirm("Deseja excluir este cliente?");

      if (!confirmar) return;

      try {
        await excluirCliente(id);

        toast("Cliente excluído com sucesso!");
      } catch (erro) {
        console.error(erro);

        toast("Erro ao excluir cliente.");
      }
    });
  });
}

function atualizarEstatisticas(clientes) {
  const totalClientes = clientes.length;

  const clientesVip = clientes.filter(
    (cliente) => Number(cliente.totalPedidos || 0) >= 5,
  ).length;

  const totalPedidos = clientes.reduce(
    (total, cliente) => total + Number(cliente.totalPedidos || 0),
    0,
  );

  const totalGasto = clientes.reduce(
    (total, cliente) => total + Number(cliente.totalGasto || 0),
    0,
  );

  const ticketMedio = totalClientes ? totalGasto / totalClientes : 0;

  document.getElementById("totalClientes").textContent = totalClientes;

  document.getElementById("clientesVip").textContent = clientesVip;

  document.getElementById("totalPedidosClientes").textContent = totalPedidos;

  document.getElementById("ticketMedio").textContent =
    `R$ ${ticketMedio.toFixed(2)}`;
}

function abrirEditarCliente(cliente) {
  abrirModal(
    "Editar Cliente",
    `
    <form id="formEditarCliente" class="form-grid">

        <div class="form-group">
            <label>Nome</label>
            <input
                id="editarNome"
                type="text"
                value="${cliente.nome || ""}"
                required>
        </div>

        <div class="form-group">
            <label>Telefone</label>
            <input
              id="editarTelefone"
              type="text"
              inputmode="numeric"
              maxlength="20"
              placeholder="+55 (19) 99999-9999"
              value="${formatarTelefone(cliente.telefone || "")}">
        </div>

        <div class="form-group">
            <label>Observações</label>
            <textarea id="editarObservacoes">${cliente.observacoes || ""}</textarea>
        </div>

        <div class="form-group">
            <label>Rua</label>
            <input
                id="editarRua"
                type="text"
                value="${cliente.endereco?.rua || ""}">
        </div>

        <div class="form-group">
            <label>Número</label>
            <input
                id="editarNumero"
                type="text"
                value="${cliente.endereco?.numero || ""}">
        </div>

        <div class="form-group">
            <label>Bairro</label>
            <input
                id="editarBairro"
                type="text"
                value="${cliente.endereco?.bairro || ""}">
        </div>

        <div class="form-group">
            <label>Complemento</label>
            <input
                id="editarComplemento"
                type="text"
                value="${cliente.endereco?.complemento || ""}">
        </div>

        <div class="modal-actions">

            <button
                type="button"
                id="cancelarEditar"
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
    `,
  );

  document
    .getElementById("cancelarEditar")
    ?.addEventListener("click", fecharModal);

  aplicarMascaraTelefone(document.getElementById("editarTelefone"));

  document
    .getElementById("formEditarCliente")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        await editarCliente(cliente.id, {
          nome: document.getElementById("editarNome").value.trim(),

          telefone: formatarTelefone(
            document.getElementById("editarTelefone").value,
          ),

          telefoneWhatsapp: document
            .getElementById("editarTelefone")
            .value.replace(/\D/g, ""),

          observacoes: document
            .getElementById("editarObservacoes")
            .value.trim(),

          endereco: {
            rua: document.getElementById("editarRua").value.trim(),

            numero: document.getElementById("editarNumero").value.trim(),

            bairro: document.getElementById("editarBairro").value.trim(),

            complemento: document
              .getElementById("editarComplemento")
              .value.trim(),
          },
        });

        toast("Cliente atualizado com sucesso!");

        fecharModal();
      } catch (erro) {
        console.error(erro);

        toast("Erro ao atualizar cliente.");
      }
    });
}

/* ==========================================
   NOVO CLIENTE
========================================== */

btnNovoCliente?.addEventListener("click", () => {
  abrirModal(
    "Novo Cliente",
    `
        <form id="formNovoCliente" class="form-grid">

            <div class="form-group">
                <label>Nome</label>
                <input type="text" id="nomeCliente" required>
            </div>

            <div class="form-group">
                <label>Telefone</label>
                <input
                  type="text"
                  id="telefoneCliente"
                  inputmode="numeric"
                  maxlength="20"
                  placeholder="+55 (19) 99999-9999">
            </div>

            <div class="form-group">
                <label>Observações</label>
                <textarea id="observacoesCliente"></textarea>
            </div>

            <div class="form-group">
                <label>Rua</label>
                <input type="text" id="ruaCliente">
            </div>

            <div class="form-group">
                <label>Número</label>
                <input type="text" id="numeroCliente">
            </div>

            <div class="form-group">
                <label>Bairro</label>
                <input type="text" id="bairroCliente">
            </div>

            <div class="form-group">
                <label>Complemento</label>
                <input type="text" id="complementoCliente">
            </div>
            </div>

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
        `,
  );

  document
    .getElementById("cancelarCliente")
    ?.addEventListener("click", fecharModal);

  aplicarMascaraTelefone(document.getElementById("telefoneCliente"));

  document
    .getElementById("formNovoCliente")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        await criarCliente({
          endereco: {
            rua: document.getElementById("ruaCliente").value.trim(),

            numero: document.getElementById("numeroCliente").value.trim(),

            bairro: document.getElementById("bairroCliente").value.trim(),

            complemento: document
              .getElementById("complementoCliente")
              .value.trim(),
          },
          nome: document.getElementById("nomeCliente").value.trim(),
          telefone: formatarTelefone(
            document.getElementById("telefoneCliente").value,
          ),
          observacoes: document
            .getElementById("observacoesCliente")
            .value.trim(),
          totalPedidos: 0,
          totalGasto: 0,
        });

        toast("Cliente criado com sucesso!");
        fecharModal();
      } catch (erro) {
        console.error(erro);
        toast("Erro ao criar cliente.");
      }
    });
});
