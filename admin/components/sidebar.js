export function carregarSidebar() {

    document.getElementById("sidebar").innerHTML = `

        <div class="logo">

            🍔 Mesa Fácil

        </div>

        <nav class="menu">

            <a href="index.html" class="active">
                🏠 Dashboard
            </a>

            <a href="pedidos.html">
                📦 Pedidos
            </a>

            <a href="produtos.html">
                🍔 Produtos
            </a>

            <a href="clientes.html">
                👥 Clientes
            </a>

            <a href="mesas.html">
                🪑 Mesas
            </a>

            <a href="financeiro.html">
                💰 Financeiro
            </a>

            <a href="relatorios.html">
                📈 Relatórios
            </a>

            <a href="whatsapp.html">
                📱 WhatsApp
            </a>

            <a href="impressora.html">
                🖨 Impressora
            </a>

            <a href="configuracoes.html">
                ⚙ Configurações
            </a>

        </nav>

    `;

}