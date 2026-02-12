const { CreditoLoja, sequelize } = require('../src/models');
const financeiroService = require('../src/features/financeiro/financeiro.service');

async function testExpiration() {
    const t = await sequelize.transaction();
    try {
        console.log('--- Testing Credit Expiration ---');

        // 1. Create a dummy expired credit
        const expiredDate = new Date();
        expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

        const client = await sequelize.models.Pessoa.findOne();
        if (!client) throw new Error('No client found for test');

        const credit = await CreditoLoja.create({
            clienteId: client.id,
            valor: 100.00,
            status: 'ATIVO',
            data_validade: expiredDate,
            codigo_cupom: 'TEST-EXPIRE'
        }, { transaction: t });

        console.log(`Created dummy credit ID ${credit.id} with validity ${expiredDate.toISOString()}`);

        // 2. Run Expiration Check (Mocking the job)
        // We need to commit first so the service can see it (or pass transaction if supported)
        // FinanceiroService checkCreditosExpirados doesn't take transaction usually, it does its own.
        // So commit dummy data.
        await t.commit();

        const result = await financeiroService.checkCreditosExpirados();
        console.log(`Expiration Job Result:`, result);

        // 3. Verify
        const updatedCredit = await CreditoLoja.findByPk(credit.id);
        console.log(`Credit Status after job: ${updatedCredit.status}`);

        if (updatedCredit.status === 'EXPIRADO') {
            console.log('✅ Success: Credit expired correctly.');
        } else {
            console.log('❌ Failure: Credit did not expire.');
        }

        // Cleanup
        await updatedCredit.destroy();

    } catch (error) {
        console.error(error);
        if (!t.finished) await t.rollback();
    } finally {
        await sequelize.close();
    }
}

testExpiration();
