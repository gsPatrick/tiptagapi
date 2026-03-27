
const { Pedido, ItemPedido, PagamentoPedido, sequelize } = require('./src/models');
const { Op } = require('sequelize');

async function investigate() {
    try {
        console.log('--- Investigating HISTOCR2 Pedidos ---');
        
        const pedidos = await Pedido.findAll({
            where: {
                codigo_pedido: { [Op.like]: 'HIST%' }
            },
            include: [
                { model: ItemPedido, as: 'itens' },
                { model: PagamentoPedido, as: 'pagamentos' }
            ],
            limit: 5
        });

        console.log(`Found ${pedidos.length} pedidos starting with HIST.`);

        pedidos.forEach(p => {
            console.log(`\nPedido: ${p.codigo_pedido}`);
            console.log(`Data: ${p.data_pedido}`);
            console.log(`Total: ${p.total}`);
            console.log(`Status: ${p.status}`);
            console.log(`Itens: ${p.itens?.length || 0}`);
            if (p.itens) {
                p.itens.forEach(i => console.log(`  - Peca ID: ${i.pecaId}, Valor: ${i.valor_unitario_final}`));
            }
            console.log(`Pagamentos: ${p.pagamentos?.length || 0}`);
            if (p.pagamentos) {
                p.pagamentos.forEach(pay => console.log(`  - Metodo: ${pay.metodo}, Valor: ${pay.valor}`));
            }
        });

    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}

investigate();
