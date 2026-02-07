const db = require('../src/models');
const { Pessoa, Peca } = db;
const { Op } = require('sequelize');

const supplierName = process.argv.slice(2).join(' ');

if (!supplierName) {
    console.error('Por favor, informe o nome do fornecedor: node scripts/count_supplier_products.js "NOME"');
    process.exit(1);
}

async function run() {
    try {
        await db.sequelize.authenticate();

        const supplier = await Pessoa.findOne({
            where: {
                nome: { [Op.iLike]: `%${supplierName}%` },
                is_fornecedor: true
            }
        });

        if (!supplier) {
            console.log(`Fornecedor "${supplierName}" não encontrado.`);
        } else {
            const count = await Peca.count({
                where: { fornecedorId: supplier.id }
            });
            console.log(`\n-----------------------------------------`);
            console.log(`Fornecedor: ${supplier.nome}`);
            console.log(`ID no Banco: ${supplier.id}`);
            console.log(`Quantidade de Peças: ${count}`);
            console.log(`-----------------------------------------\n`);
        }
    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

run();
