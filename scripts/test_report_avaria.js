require('dotenv').config();
const { Pessoa } = require('../src/models');
const catalogoService = require('../src/features/catalogo/catalogo.service');

async function testReportAvaria() {
    const supplierId = 2110;
    const testPhone = '71982862912';

    console.log('--- TESTING REPORT AVARIA ---');

    // 1. Save original phone
    const supplier = await Pessoa.findByPk(supplierId);
    const originalPhone = supplier.telefone_whatsapp;
    console.log(`Original Phone: ${originalPhone}`);

    try {
        // 2. Set test phone
        await supplier.update({ telefone_whatsapp: testPhone });
        console.log(`Set phone to ${testPhone}`);

        // 3. Trigger Report Avaria (Supplier Level)
        console.log('Triggering reportAvaria via service...');
        const result = await catalogoService.reportAvaria(null, 'Teste de avaria no recebimento do lote.', supplierId);
        console.log('Result:', JSON.stringify(result, null, 2));

    } catch (err) {
        console.error('Error during test:', err);
    } finally {
        // 4. Restore original phone
        await supplier.update({ telefone_whatsapp: originalPhone });
        console.log('Restored original phone.');
    }
}

testReportAvaria().then(() => process.exit(0));
