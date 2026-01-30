const xlsx = require('xlsx');
const path = require('path');
const db = require('../src/models');
const { Pessoa } = db;

const PECAS_PATH = path.resolve(__dirname, '../pecas.xlsx');

async function run() {
    console.log('\n--- Final Role Enforcement & Duplicate Cleanup ---');

    try {
        await db.sequelize.authenticate();
        console.log('Database connected.');

        // 1. Get ALL supplier names from pecas.xlsx (normalized)
        const workbook = xlsx.readFile(PECAS_PATH);
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const supplierNames = new Set(data.map(r => r.fornecedor ? r.fornecedor.toString().trim().toUpperCase() : null).filter(Boolean));
        console.log(`Found ${supplierNames.size} unique suppliers in Excel.`);

        // 2. Load all people from DB
        const allPeople = await Pessoa.findAll();
        console.log(`Processing ${allPeople.length} people in DB...`);

        let updatedCount = 0;
        for (const p of allPeople) {
            const normalizedName = p.nome.toString().trim().toUpperCase();
            const shouldBeSupplier = supplierNames.has(normalizedName);
            const shouldBeClient = !shouldBeSupplier;

            // Only update if current state is wrong or if it's "Both"
            if (p.is_fornecedor !== shouldBeSupplier || p.is_cliente !== shouldBeClient) {
                await p.update({
                    is_fornecedor: shouldBeSupplier,
                    is_cliente: shouldBeClient
                });
                updatedCount++;
            }
        }

        console.log(`\nCleanup complete!`);
        console.log(`- Total people checked: ${allPeople.length}`);
        console.log(`- People updated: ${updatedCount}`);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

run();
