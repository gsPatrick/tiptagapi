
const { Pessoa, CreditoLoja, sequelize } = require('./src/models');
const { Op } = require('sequelize');

async function run() {
    console.log('--- CLEANUP UNDUE CREDITS ---');
    
    try {
        // Find credits starting with CASHBACK-
        const credits = await CreditoLoja.findAll({
            where: {
                codigo_cupom: { [Op.like]: 'CASHBACK-%' }
            },
            include: [{
                model: Pessoa,
                as: 'cliente',
                where: {
                    is_fornecedor: false
                }
            }]
        });

        console.log(`Found ${credits.length} undue credits to remove.`);

        if (credits.length > 0) {
            for (const cred of credits) {
                console.log(`Removing credit ID ${cred.id} (R$ ${cred.valor}) for client ${cred.cliente.nome} (ID ${cred.cliente.id})`);
                await cred.destroy();
            }
            console.log('Cleanup completed successfully.');
        } else {
            console.log('No undue credits found.');
        }

    } catch (err) {
        console.error('Error during cleanup:', err);
    } finally {
        await sequelize.close();
    }
}

run();
