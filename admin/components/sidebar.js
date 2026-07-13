export function carregarSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const paginaAtual = window.location.pathname.split("/").pop() || "index.html";

  const links = [
    { href: "index.html", emoji: "🏠", texto: "Dashboard" },
    { href: "pedidos.html", emoji: "📦", texto: "Pedidos" },
    { href: "pdv.html", emoji: "🛒", texto: "PDV" },
    { href: "produtos.html", emoji: "🍔", texto: "Produtos" },
    { href: "clientes.html", emoji: "👥", texto: "Clientes" },
    { href: "mesas.html", emoji: "🪑", texto: "Mesas" },
    { href: "taxas.html", emoji: "🚚", texto: "Taxas de Entrega" },
    { href: "financeiro.html", emoji: "💰", texto: "Financeiro" },
    { href: "relatorios.html", emoji: "📈", texto: "Relatórios" },
    { href: "whatsapp.html", emoji: "📱", texto: "WhatsApp" },
    { href: "impressora.html", emoji: "🖨", texto: "Impressora" },
    { href: "configuracoes.html", emoji: "⚙", texto: "Configurações" },
    { href: "adicionais.html", emoji: "➕", texto: "Adicionais" },
    { href: "ferramentas.html", emoji: "🛠", texto: "Ferramentas" },
  ];

  const menuHtml = links
    .map((item) => {
      const ativo = item.href === paginaAtual ? "active" : "";
      return `
        <a href="${item.href}" class="${ativo}">
          <span class="menu-icon">${item.emoji}</span>
          <span class="menu-text">${item.texto}</span>
        </a>
      `;
    })
    .join("");

  sidebar.innerHTML = `
    <div class="sidebar-shell">
      <div class="sidebar-top">
        <div class="logo">
          <span class="logo-icon">🍔</span>
          <span class="logo-text">Mesa Fácil</span>
        </div>

        <button
          id="sidebarToggle"
          class="sidebar-toggle"
          type="button"
          aria-label="Recolher menu"
          title="Recolher menu"
        >
          ❮
        </button>
      </div>

      <nav class="menu">
        ${menuHtml}
      </nav>
    </div>
  `;

  const COLLAPSED_KEY = "adminSidebarCollapsed";
  const toggleBtn = document.getElementById("sidebarToggle");

  function aplicarEstado(colapsada) {
    sidebar.classList.toggle("collapsed", colapsada);

    if (toggleBtn) {
      toggleBtn.textContent = colapsada ? "❯" : "❮";
      toggleBtn.setAttribute(
        "aria-label",
        colapsada ? "Expandir menu" : "Recolher menu",
      );
      toggleBtn.title = colapsada ? "Expandir menu" : "Recolher menu";
    }
  }

  const salvo = localStorage.getItem(COLLAPSED_KEY) === "true";
  aplicarEstado(salvo);

  toggleBtn?.addEventListener("click", () => {
    const colapsada = !sidebar.classList.contains("collapsed");
    aplicarEstado(colapsada);
    localStorage.setItem(COLLAPSED_KEY, String(colapsada));
  });
}
