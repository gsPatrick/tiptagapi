
const { ContaCorrentePessoa, Pessoa } = require('./src/models');
const { Op } = require('sequelize');

async function check() {
    try {
        const id = 1555;
        const movements = await ContaCorrentePessoa.findAll({
            where: { pessoaId: id },
            order: [['data_movimento', 'DESC']]
        });
        
        console.log('--- MOVEMENTS FOR KARINE (ID 1555) ---');
        let balance = 0;
        movements.forEach(m => {
            const val = parseFloat(m.valor);
            console.log(`${m.data_movimento} | ${m.tipo} | R$ ${val.toFixed(2)} | ${m.descricao}`);
            balance += (m.tipo === 'CREDITO' ? val : -val);
        });
        
        console.log('---------------------------------------');
        console.log('TOTAL CALCULATED BALANCE:', balance.toFixed(2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

check();
