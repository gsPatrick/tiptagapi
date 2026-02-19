require('dotenv').config();
const { Pedido, PagamentoPedido, ItemPedido, Peca, Sacolinha, MovimentacaoEstoque, MovimentacaoCaixaDiario } = require('../src/models');
const { Op } = require('sequelize');

async function cleanup() {
    console.log('--- STARTING CLEANUP ---');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Find pieces involved in today's sales
    const pedidos = await Pedido.findAll({
        where: { createdAt: { [Op.gte]: today } }
    });
    const pedidoIds = pedidos.map(p => p.id);

    console.log(`Cleaning up ${pedidoIds.length} pedidos...`);

    for (const pedidoId of pedidoIds) {
        const itens = await ItemPedido.findAll({ where: { pedidoId } });
        for (const item of itens) {
            // Restore Piece
            await Peca.update(
                { status: 'DISPONIVEL', data_venda: null, data_saida_estoque: null, sacolinhaId: null },
                { where: { id: item.pecaId } }
            );
        }

        // Delete related movements
        await MovimentacaoEstoque.destroy({ where: { pecaId: itens.map(i => i.pecaId), createdAt: { [Op.gte]: today } } });

        // Delete payments
        await PagamentoPedido.destroy({ where: { pedidoId } });

        // Delete items
        await ItemPedido.destroy({ where: { pedidoId } });

        // Delete Pedido
        await Pedido.destroy({ where: { id: pedidoId } });
    }

    // 2. Cleanup Sacolinhas
    const sacolinhas = await Sacolinha.findAll({
        where: { createdAt: { [Op.gte]: today } }
    });
    console.log(`Cleaning up ${sacolinhas.length} sacolinhas...`);

    for (const sac of sacolinhas) {
        // Release pieces
        await Peca.update(
            { sacolinhaId: null, status: 'DISPONIVEL' },
            { where: { sacolinhaId: sac.id } }
        );
        // Delete sacolinha
        await sac.destroy({ force: true });
    }

    // 3. Cleanup Caixa Movements (optional but good for balance)
    await MovimentacaoCaixaDiario.destroy({
        where: { createdAt: { [Op.gte]: today }, descricao: { [Op.like]: '%Pedido%' } }
    });

    console.log('--- CLEANUP COMPLETE ---');
}

cleanup().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
