import { abrirModal, fecharModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

import {
  ouvirAdicionais,
  criarAdicional,
  editarAdicional,
  excluirAdicional
} from "../../js/services/additionals.js";

/* ==========================================
   ESTADO / ELEMENTOS
========================================== */

let listaAdicionais;
let buscarAdicional;
let btnNovoAdicional;

let adicionaisCache = [];

/* ==========================================
   INIT
========================================== */

function initAdicionais() {
  listaAdicionais = document.getElementById("listaAdicionais");
  buscarAdicional = document.getElementById("buscarAdicional");
  btnNovoAdicional = document.getElementById("novoAdicional");

  ouvirAdicionais((lista) => {
    adicionaisCache = lista;
    aplicarFiltros();
  });

  buscarAdicional?.addEventListener("input", aplicarFiltros);
  btnNovoAdicional?.addEventListener("click", abrirModalNovoAdicional);
}

/* ==========================================
   HELPERS
========================================== */

function escapeHtml(texto = "") {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarPreco(valor) {
  return Number(valor || 0).toFixed(2);
}

/* ==========================================
   FILTROS
========================================== */

function aplicarFiltros() {
  let lista = [...adicionaisCache];

  const termo = buscarAdicional?.value?.trim().toLowerCase() || "";

  if (termo) {
    lista = lista.filter((item) => {
      const nome = (item.nome || "").toLowerCase();
      return nome.includes(termo);
    });
  }

  renderAdicionais(lista);
}

/* ==========================================
   RENDER
========================================== */

function renderAdicionais(lista) {
  if (!listaAdicionais) return;

  if (!lista.length) {
    listaAdicionais.innerHTML = `
      <div class="empty-state">
        <h3>Nenhum adicional encontrado</h3>
        <p>Os adicionais globais cadastrados aparecerão aqui.</p>
      </div>
    `;
    return;
  }

  listaAdicionais.innerHTML = "";

  lista.forEach((item) => {
    const card = document.createElement("div");
    card.className = "panel produto-admin-card";

    const ativo = item.ativo !== false;

    card.innerHTML = `
      <div class="produto-admin-top">
        <div class="produto-admin-thumb-wrap">
          <div class="produto-admin-thumb produto-admin-thumb--empty">
            ➕
          </div>
        </div>

        <div class="produto-admin-info">
          <div class="panel-title">
            ${escapeHtml(item.nome || "Sem nome")}
          </div>

          <p><strong>Preço:</strong> R$ ${formatarPreco(item.preco || 0)}</p>
          <p><strong>Status:</strong> ${ativo ? "Ativo" : "Inativo"}</p>
        </div>
      </div>

      <div class="produto-admin-actions">
        <button class="btn btn-primary btn-editar-adicional">✏️ Editar</button>
        <button class="btn btn-secondary btn-excluir-adicional">🗑 Excluir</button>
      </div>
    `;

    card.querySelector(".btn-editar-adicional")?.addEventListener("click", () => {
      abrirModalEditarAdicional(item);
    });

    card.querySelector(".btn-excluir-adicional")?.addEventListener("click", async () => {
      const confirmar = confirm(`Excluir "${item.nome}"?`);
      if (!confirmar) return;

      try {
        await excluirAdicional(item.id);
        toast("Adicional excluído com sucesso!");
      } catch (erro) {
        console.error(erro);
        toast("Erro ao excluir adicional.");
      }
    });

    listaAdicionais.appendChild(card);
  });
}

/* ==========================================
   MODAL - NOVO
========================================== */

function abrirModalNovoAdicional() {
  abrirModal(
    "Novo adicional",
    `
      <form id="formAdicional" class="form-grid">
        <div class="form-group">
          <label>Nome</label>
          <input
            type="text"
            id="nomeAdicional"
            placeholder="Ex.: Queijo extra, Bacon, Ovo, Catupiry"
            required
          >
        </div>

        <div class="form-group">
          <label>Preço</label>
          <input
            type="number"
            id="precoAdicional"
            step="0.01"
            value="0"
          >
        </div>

        <div class="form-group">
          <label>Status</label>
          <select id="ativoAdicional">
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>

        <div class="modal-actions">
          <button type="button" id="cancelarAdicional" class="btn btn-secondary">
            Cancelar
          </button>

          <button type="submit" class="btn btn-primary">
            Salvar
          </button>
        </div>
      </form>
    `
  );

  document.getElementById("cancelarAdicional")?.addEventListener("click", fecharModal);

  document.getElementById("formAdicional")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const nome = document.getElementById("nomeAdicional").value.trim();
      const preco = Number(document.getElementById("precoAdicional").value || 0);
      const ativo = document.getElementById("ativoAdicional").value === "true";

      if (!nome) {
        toast("Informe o nome do adicional.");
        return;
      }

      await criarAdicional({
        nome,
        preco,
        ativo
      });

      toast("Adicional salvo com sucesso!");
      fecharModal();
    } catch (erro) {
      console.error(erro);
      toast("Erro ao salvar adicional.");
    }
  });
}

/* ==========================================
   MODAL - EDITAR
========================================== */

function abrirModalEditarAdicional(item) {
  abrirModal(
    "Editar adicional",
    `
      <form id="formEditarAdicional" class="form-grid">
        <div class="form-group">
          <label>Nome</label>
          <input
            type="text"
            id="editNomeAdicional"
            value="${escapeHtml(item.nome || "")}"
            required
          >
        </div>

        <div class="form-group">
          <label>Preço</label>
          <input
            type="number"
            id="editPrecoAdicional"
            step="0.01"
            value="${Number(item.preco || 0)}"
          >
        </div>

        <div class="form-group">
          <label>Status</label>
          <select id="editAtivoAdicional">
            <option value="true" ${item.ativo !== false ? "selected" : ""}>Ativo</option>
            <option value="false" ${item.ativo === false ? "selected" : ""}>Inativo</option>
          </select>
        </div>

        <div class="modal-actions">
          <button type="button" id="cancelarEditarAdicional" class="btn btn-secondary">
            Cancelar
          </button>

          <button type="submit" class="btn btn-primary">
            Salvar alterações
          </button>
        </div>
      </form>
    `
  );

  document.getElementById("cancelarEditarAdicional")?.addEventListener("click", fecharModal);

  document.getElementById("formEditarAdicional")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const nome = document.getElementById("editNomeAdicional").value.trim();
      const preco = Number(document.getElementById("editPrecoAdicional").value || 0);
      const ativo = document.getElementById("editAtivoAdicional").value === "true";

      if (!nome) {
        toast("Informe o nome do adicional.");
        return;
      }

      await editarAdicional(item.id, {
        nome,
        preco,
        ativo
      });

      toast("Adicional atualizado com sucesso!");
      fecharModal();
    } catch (erro) {
      console.error(erro);
      toast("Erro ao atualizar adicional.");
    }
  });
}

initAdicionais();