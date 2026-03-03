const { sequelize, CreditoLoja, Pessoa } = require('../src/models');
const { Op } = require('sequelize');

/**
 * Script to remove store credit from people who are NOT suppliers.
 * Logic: Set valor to 0 and status to 'USADO' for all active credits where is_fornecedor is false.
 */
async function cleanClientCredits() {
    const t = await sequelize.transaction();
    try {
        console.log("Starting credit cleanup for non-suppliers...");

        // Find all credits where the owner is NOT a supplier
        const creditsToClean = await CreditoLoja.findAll({
            include: [{
                model: Pessoa,
                as: 'cliente',
                where: { is_fornecedor: false }
            }],
            where: {
                valor: { [Op.gt]: 0 },
                status: 'ATIVO'
            },
            transaction: t
        });

        console.log(`Found ${creditsToClean.length} active credit records belonging to non-suppliers.`);

        let totalCleaned = 0;
        for (const credit of creditsToClean) {
            const valorOriginal = parseFloat(credit.valor);
            await credit.update({
                valor: 0,
                status: 'USADO' // Marking as USADO to effectively zero out the balance
            }, { transaction: t });
            totalCleaned += valorOriginal;
        }

        await t.commit();
        console.log(`\n✅ CLEANUP COMPLETE:`);
        console.log(`- Credits cleared: ${creditsToClean.length}`);
        console.log(`- Total value removed: R$ ${totalCleaned.toFixed(2)}`);

        process.exit(0);
    } catch (err) {
        if (t) await t.rollback();
        console.error("ERROR during cleanup:", err);
        process.exit(1);
    }
}

cleanClientCredits();
