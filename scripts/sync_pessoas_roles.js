const xlsx = require('xlsx');
const path = require('path');
const { Op } = require('sequelize');
const db = require('../src/models');
const { Pessoa } = db;

const PECAS_PATH = path.resolve(__dirname, '../pecas.xlsx');
const PESSOAS_PATH = path.resolve(__dirname, '../pessoas.xlsx');

async function run() {
    console.log('\n--- Syncing People Roles (Client vs Supplier) ---');

    try {
        await db.sequelize.authenticate();
        console.log('Database connected.');

        // 1. Get unique supplier names from pecas.xlsx
        const pecasWorkbook = xlsx.readFile(PECAS_PATH);
        const pecasSheet = pecasWorkbook.Sheets[pecasWorkbook.SheetNames[0]];
        const pecasData = xlsx.utils.sheet_to_json(pecasSheet);

        const supplierNames = new Set();
        pecasData.forEach(row => {
            if (row.fornecedor) {
                supplierNames.add(row.fornecedor.toString().trim().toLowerCase());
            }
        });
        console.log(`Found ${supplierNames.size} unique supplier names in pecas.xlsx.`);

        // 2. Load all people from pessoas.xlsx
        const pessoasWorkbook = xlsx.readFile(PESSOAS_PATH);
        const pessoasSheet = pessoasWorkbook.Sheets[pessoasWorkbook.SheetNames[0]];
        const pessoasData = xlsx.utils.sheet_to_json(pessoasSheet);
        console.log(`Loaded ${pessoasData.length} records from pessoas.xlsx.`);

        // 3. Process each person and prepare for update
        console.log('Preparing updates...');

        const existingPeople = await Pessoa.findAll({
            attributes: ['id', 'nome', 'is_fornecedor', 'is_cliente']
        });

        const peopleMap = new Map();
        existingPeople.forEach(p => {
            peopleMap.set(p.nome.toLowerCase(), p);
        });

        let supplierCount = 0;
        let clientCount = 0;
        let newCount = 0;

        for (const row of pessoasData) {
            if (!row.nome) continue;

            const name = row.nome.toString().trim();
            const normalizedName = name.toLowerCase();
            const isSupplier = supplierNames.has(normalizedName);

            const existing = peopleMap.get(normalizedName);

            if (existing) {
                // Check if update is needed to save query time
                if (existing.is_fornecedor !== isSupplier || existing.is_cliente !== !isSupplier) {
                    await Pessoa.update({
                        is_fornecedor: isSupplier,
                        is_cliente: !isSupplier
                    }, {
                        where: { id: existing.id }
                    });
                }
            } else {
                // Create new
                await Pessoa.create({
                    nome: name,
                    is_fornecedor: isSupplier,
                    is_cliente: !isSupplier,
                    tipo: 'PF'
                });
                newCount++;
            }

            if (isSupplier) supplierCount++;
            else clientCount++;
        }

        console.log(`\nSync complete!`);
        console.log(`- Total unique people in Excel: ${pessoasData.length}`);
        console.log(`- Marked as Suppliers: ${supplierCount}`);
        console.log(`- Marked as Clients: ${clientCount}`);
        console.log(`- New records created: ${newCount}`);

    } catch (err) {
        console.error('\nFATAL ERROR:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

run();
