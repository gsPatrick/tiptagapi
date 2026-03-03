const xlsx = require('xlsx');
const path = require('path');
const db = require('../src/models');
const { Pessoa } = db;

const PECAS_PATH = path.resolve(__dirname, '../pecas.xlsx');

async function run() {
    console.log('\n--- Forced Role Cleanup ---');
    try {
        await db.sequelize.authenticate();

        const workbook = xlsx.readFile(PECAS_PATH);
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const supplierNames = new Set(data.map(r => r.fornecedor ? r.fornecedor.toString().trim().toUpperCase() : null).filter(Boolean));
        console.log(`Suppliers in Excel: ${supplierNames.size}`);

        const allPeople = await Pessoa.findAll();
        let updatedCount = 0;

        for (const p of allPeople) {
            const normalizedName = p.nome.toString().trim().toUpperCase();
            const shouldBeSupplier = supplierNames.has(normalizedName);
            const shouldBeClient = !shouldBeSupplier;

            // Log if we find "Ambos"
            if (p.is_fornecedor && p.is_cliente) {
                console.log(`[BOTH] Found ${p.id} (${p.nome}) with both roles. Setting to ${shouldBeSupplier ? 'SUPPLIER' : 'CLIENT'}.`);
            }

            if (p.is_fornecedor !== shouldBeSupplier || p.is_cliente !== shouldBeClient) {
                await p.update({
                    is_fornecedor: shouldBeSupplier,
                    is_cliente: shouldBeClient
                });
                updatedCount++;
            }
        }

        console.log(`\nSuccess: ${updatedCount} people updated.`);
    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        await db.sequelize.close();
    }
}

run();
