const { Pessoa, ContaCorrentePessoa, CreditoLoja, sequelize } = require('../src/models');
const { Op } = require('sequelize');

async function checkGislaine() {
    try {
        // Find Gislaine
        const gislaine = await Pessoa.findOne({
            where: {
                nome: { [Op.like]: '%GISLAINE APARECIDA CRUNIEL%' }
            }
        });

        if (!gislaine) {
            console.log('Gislaine not found.');
            return;
        }

        console.log(`Found Gislaine: ${gislaine.nome} (ID: ${gislaine.id})`);

        // Check for ANY credits for this user, maybe under a different ID?
        // Or check CreditoLoja table for any large amounts

        const allGislaines = await Pessoa.findAll({
            where: {
                nome: { [Op.like]: '%GISLAINE APARECIDA%' }
            }
        });

        console.log(`Found ${allGislaines.length} Gislaines:`);
        allGislaines.forEach(p => console.log(`${p.id}: ${p.nome}`));

        for (const p of allGislaines) {
            const cLoja = await CreditoLoja.sum('valor', { where: { clienteId: p.id, status: 'ATIVO' } });
            const cCC = await ContaCorrentePessoa.sum('valor', { where: { pessoaId: p.id, tipo: 'CREDITO' } });
            console.log(`User ${p.id}: CreditoLoja=${cLoja}, ContaCorrente=${cCC}`);
        }

    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
    }
}

checkGislaine();
