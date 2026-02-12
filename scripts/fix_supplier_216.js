const { ContaCorrentePessoa, CreditoLoja, sequelize } = require('../src/models');

async function fixSupplier() {
    const t = await sequelize.transaction();
    try {
        const supplierId = 216;

        // 1. Remove Incorrect Cashback (CreditoLoja)
        const cashback = await CreditoLoja.findOne({
            where: {
                clienteId: supplierId,
                codigo_cupom: 'CASHBACK-PDV-1770059649261'
            }
        });

        if (cashback) {
            console.log(`Deleting Cashback: R$ ${cashback.valor} (ID: ${cashback.id})`);
            await cashback.destroy({ transaction: t }); // Or force delete if paranoid
        } else {
            console.log('Cashback not found (maybe already deleted?)');
        }

        // 2. Adjust Commission Credits to 50% (R$ 47.50 each)
        // Items were sold for 95.00 each. 50% is 47.50.
        // Current values are ~42.02 and ~52.98 (likely due to incorrect split or fee deduction).

        const credits = await ContaCorrentePessoa.findAll({
            where: { pessoaId: supplierId },
            transaction: t
        });

        for (const c of credits) {
            // Check if it matches the sales (approximate date/desc)
            if (c.descricao.includes('TAG-7961') || c.descricao.includes('TAG-7963')) {
                console.log(`Updating Credit ID ${c.id}: ${c.valor} -> 47.50`);
                await c.update({ valor: 47.50 }, { transaction: t });
            }
        }

        await t.commit();
        console.log('Fix applied successfully.');

    } catch (error) {
        await t.rollback();
        console.error('Error applying fix:', error);
    } finally {
        await sequelize.close();
    }
}

fixSupplier();
