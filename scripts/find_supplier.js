require('dotenv').config();
const { Pessoa, Peca, Sequelize } = require('../src/models');
const { Op } = require('sequelize');

async function findSupplier() {
    try {
        console.log('Searching for "Gislaine"...');
        const suppliers = await Pessoa.findAll({
            where: {
                nome: { [Op.iLike]: '%Gislaine%' }
            },
            include: [{
                model: Peca,
                as: 'pecasFornecidas',
                attributes: ['id', 'status'],
                required: false
            }]
        });

        if (suppliers.length === 0) {
            console.log('No supplier found with name like "Gislaine".');
        } else {
            console.log(`Found ${suppliers.length} match(es):`);
            suppliers.forEach(s => {
                const productCount = s.pecasFornecidas ? s.pecasFornecidas.length : 0;
                console.log(`- ID: ${s.id} | Nome: "${s.nome}" | Role: ${s.role} | Produtos: ${productCount}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

findSupplier();
