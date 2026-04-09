const { Pessoa, ContaCorrentePessoa, CreditoLoja } = require('../src/models');
const { Op } = require('sequelize');

async function research() {
    const suppliersToTest = ['AMANDA SANCHEZ', 'ALINE LIMA', 'ANA LAURA GUIMARAES'];
    console.log('--- RESEARCH MARCH 2026 ENTRIES ---');

    for (const name of suppliersToTest) {
        const p = await Pessoa.findOne({ where: { nome: { [Op.substring]: name } } });
        if (!p) {
            console.log(`Supplier ${name} not found.`);
            continue;
        }

        console.log(`\nSupplier: ${p.nome} (ID: ${p.id})`);
        
        const ccEntries = await ContaCorrentePessoa.findAll({
            where: {
                pessoa_id: p.id,
                data_movimento: {
                    [Op.gte]: '2026-03-01',
                    [Op.lt]: '2026-04-01'
                }
            }
        });
        
        console.log(`  ContaCorrentePessoa entries in March: ${ccEntries.length}`);
        ccEntries.forEach(e => {
            console.log(`    - ID: ${e.id} | Valor: ${e.valor} | Tipo: ${e.tipo} | Data: ${e.data_movimento} | Desc: ${e.descricao}`);
        });

        const storeCredits = await CreditoLoja.findAll({
            where: {
                cliente_id: p.id,
                createdAt: {
                    [Op.gte]: '2026-03-01',
                    [Op.lt]: '2026-04-01'
                }
            }
        });
        console.log(`  CreditoLoja entries in March: ${storeCredits.length}`);
        storeCredits.forEach(c => {
            console.log(`    - ID: ${c.id} | Valor: ${c.valor} | Status: ${c.status} | Data: ${c.createdAt} | Cupom: ${c.codigo_cupom}`);
        });
    }
}

research().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
