const { Peca, Pedido, ItemPedido, MovimentacaoEstoque, ContaCorrentePessoa, PagamentoPedido, sequelize } = require('../src/models');
const { Op } = require('sequelize');

async function cleanup() {
    const t = await sequelize.transaction();
    try {
        console.log('Starting cleanup of TEST data...');

        // 1. Find Test Items
        const testItems = await Peca.findAll({
            where: {
                codigo_etiqueta: { [Op.like]: 'TEST-%' }
            },
            transaction: t
        });

        const itemIds = testItems.map(i => i.id);
        console.log(`Found ${itemIds.length} test items:`, testItems.map(i => i.codigo_etiqueta));

        if (itemIds.length === 0) {
            console.log('No test data found.');
            await t.rollback();
            return;
        }

        // 2. Find Related Orders via ItemPedido
        const itemPedidos = await ItemPedido.findAll({
            where: { pecaId: itemIds },
            transaction: t
        });

        const orderIds = [...new Set(itemPedidos.map(ip => ip.pedidoId))];
        console.log(`Found ${orderIds.length} related orders:`, orderIds);

        // 3. Delete Financial Records (ContaCorrentePessoa) linked to Items or Orders
        // Linked to Item (Credit)
        await ContaCorrentePessoa.destroy({
            where: {
                referencia_origem: itemIds,
                tipo: 'CREDITO',
                descricao: { [Op.like]: 'Venda peça TEST-%' }
            },
            transaction: t
        });

        // Linked to Order (Debito or Payment Credit)
        if (orderIds.length > 0) {
            await ContaCorrentePessoa.destroy({
                where: {
                    referencia_origem: orderIds,
                    [Op.or]: [
                        { descricao: { [Op.like]: 'Uso de crédito Pedido PDV-%' } },
                        { descricao: { [Op.like]: 'Venda PDV PDV-%' } }
                    ]
                },
                transaction: t
            });
        }

        // 4. Delete Stock Movements
        await MovimentacaoEstoque.destroy({
            where: { pecaId: itemIds },
            transaction: t
        });

        // 5. Delete ItemPedido
        await ItemPedido.destroy({
            where: { pecaId: itemIds },
            transaction: t
        });

        // 6. Delete PagamentoPedido
        if (orderIds.length > 0) {
            await PagamentoPedido.destroy({
                where: { pedidoId: orderIds },
                transaction: t
            });

            // 7. Delete Pedido
            await Pedido.destroy({
                where: { id: orderIds },
                transaction: t
            });
        }

        // 8. Delete Peca
        await Peca.destroy({
            where: { id: itemIds },
            transaction: t
        });

        await t.commit();
        console.log('Cleanup completed successfully.');

    } catch (error) {
        await t.rollback();
        console.error('Error during cleanup:', error);
    } finally {
        await sequelize.close();
    }
}

cleanup();
