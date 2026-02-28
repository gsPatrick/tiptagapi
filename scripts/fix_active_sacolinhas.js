const { Peca, Sacolinha } = require('../src/models');
const { Op } = require('sequelize');

async function fixSacolinhas() {
    try {
        console.log('--- Initing Sacolinha Fix Script ---');

        // Find pieces in active sacolinhas where price is null
        const pieces = await Peca.findAll({
            where: {
                sacolinhaId: { [Op.ne]: null },
                preco_venda_sacolinha: null
            },
            include: [{
                model: Sacolinha,
                as: 'sacolinha',
                where: { status: 'ABERTA' }
            }]
        });

        console.log(`Found ${pieces.length} pieces in open sacolinhas with null negotiated price.`);

        for (const p of pieces) {
            console.log(`Fixing piece ID ${p.id}: setting preco_venda_sacolinha to ${p.preco_venda}`);
            await p.update({ preco_venda_sacolinha: p.preco_venda });
        }

        console.log('--- Fix Completed successfully ---');
        process.exit(0);
    } catch (error) {
        console.error('Error during fix:', error);
        process.exit(1);
    }
}

fixSacolinhas();
