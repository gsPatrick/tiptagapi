const { Peca, ContaCorrentePessoa, sequelize } = require('../src/models');
const { Op } = require('sequelize');

async function fixHistoryCredits() {
    const t = await sequelize.transaction();
    try {
        console.log('Starting Fix for Historical Credits...');

        // 1. Find Pecas that were imported as VENDIDA (Sold in history)
        // Criteria: data_venda is 2025-12-24 (The specific import date)
        const historyDate = new Date('2025-12-24');
        const nextDay = new Date('2025-12-25');

        const historyItems = await Peca.findAll({
            where: {
                status: 'VENDIDA',
                data_venda: {
                    [Op.gte]: historyDate,
                    [Op.lt]: nextDay
                }
            },
            attributes: ['id', 'codigo_etiqueta'],
            transaction: t
        });

        const itemIds = historyItems.map(i => i.id);
        console.log(`Found ${itemIds.length} historical sold items (Date: 2025-12-24).`);

        if (itemIds.length === 0) {
            console.log('No historical sold items found to fix.');
            await t.rollback();
            return;
        }

        // 2. Find and Delete Credits linked to these items
        const credits = await ContaCorrentePessoa.findAll({
            where: {
                referencia_origem: itemIds,
                tipo: 'CREDITO'
            },
            transaction: t
        });

        const totalValue = credits.reduce((acc, c) => acc + parseFloat(c.valor), 0);
        console.log(`Found ${credits.length} financial records to delete.`);
        console.log(`Total Value to Remvoe: R$ ${totalValue.toFixed(2)}`);

        if (credits.length > 0) {
            await ContaCorrentePessoa.destroy({
                where: {
                    id: credits.map(c => c.id)
                },
                transaction: t
            });
            console.log('Credits deleted.');
        }

        await t.commit();
        console.log('Fix applied successfully.');

    } catch (error) {
        await t.rollback();
        console.error('Error fixing history credits:', error);
    } finally {
        await sequelize.close();
    }
}

fixHistoryCredits();
