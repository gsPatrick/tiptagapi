const db = require('../src/models');
const pessoasService = require('../src/features/pessoas/pessoas.service');
const catalogoService = require('../src/features/catalogo/catalogo.service');

async function test() {
    console.log('\n--- Testing Filter Improvements ---');

    try {
        await db.sequelize.authenticate();
        console.log('Database connected.');

        // 1. Test Pessoas Boolean Filter
        console.log('\nTesting Pessoas Filter: is_fornecedor="true"');
        const suppliers = await pessoasService.getAll({ is_fornecedor: 'true' });
        const allSuppliers = suppliers.every(p => p.is_fornecedor === true);
        console.log(`- Result: Found ${suppliers.length} items. All items are suppliers: ${allSuppliers}`);

        console.log('\nTesting Pessoas Filter: is_cliente="true"');
        const clients = await pessoasService.getAll({ is_cliente: 'true' });
        const allClients = clients.every(p => p.is_cliente === true);
        console.log(`- Result: Found ${clients.length} items. All items are clients: ${allClients}`);

        // 2. Test Catalogo Numeric ID Filter
        console.log('\nTesting Catalogo Filter: fornecedorId="2" (String)');
        const pecas = await catalogoService.getAllPecas({ fornecedorId: '2' });
        const allMatch = pecas.every(p => p.fornecedorId === 2);
        console.log(`- Result: Found ${pecas.length} items. All items match supplier ID 2: ${allMatch}`);

        console.log('\n--- All service tests completed successfully ---');
    } catch (err) {
        console.error('\nTest failed:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

test();
