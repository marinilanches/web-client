import { ouvirPedidos } from "../../js/services/orders.js";
import { toast } from "../components/toast.js";


let primeiraLeitura = true;

const pedidosRecebidos = new Set();

const audioNovoPedido = new Audio(
    "../../assets/sounds/novo-pedido.mp3"
);

audioNovoPedido.loop = true;
audioNovoPedido.volume = 1;


ouvirPedidos((pedidos) => {

    if (primeiraLeitura) {

        pedidos
            .filter((p) => p.status === "RECEBIDO")
            .forEach((p) => pedidosRecebidos.add(p.id));

        primeiraLeitura = false;

        return;
    }


    pedidos.forEach((pedido) => {

        if (
            pedido.status === "RECEBIDO" &&
            !pedidosRecebidos.has(pedido.id)
        ) {

            pedidosRecebidos.add(pedido.id);


            audioNovoPedido.currentTime = 0;

            audioNovoPedido.play()
                .catch(() => {});


            toast(
                `🔔 Novo pedido recebido<br>
                 Pedido #${pedido.numeroPedido}`,
                "success"
            );
        }

    });

});