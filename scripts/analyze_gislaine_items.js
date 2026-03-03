const { Peca, ItemPedido, ContaCorrentePessoa, sequelize } = require('../src/models');

async function analyze() {
    try {
        const supplierId = 1261;
        console.log(`Analyzing Gislaine (ID: ${supplierId})...`);

        // 1. Get Sold Items
        const items = await Peca.findAll({
            where: { fornecedorId: supplierId, status: 'VENDIDA' }
        });
        console.log(`Found ${items.length} sold items.`);

        let totalPreco = 0;
        let totalComissao = 0;

        items.forEach(i => {
            console.log(`ID: ${i.id} - ${i.codigo_etiqueta} - ${i.descricao_curta} - Price: ${i.preco_venda}`);
            totalPreco += parseFloat(i.preco_venda);
            totalComissao += parseFloat(i.preco_venda) * 0.5;
        });

        console.log(`Total Sold Value: R$ ${totalPreco.toFixed(2)}`);
        console.log(`Expected Commission (50%): R$ ${totalComissao.toFixed(2)}`);

        // 2. Get Financial Records
        const credits = await ContaCorrentePessoa.findAll({
            where: { pessoaId: supplierId, tipo: 'CREDITO' }
        });

        const totalCredits = credits.reduce((acc, c) => acc + parseFloat(c.valor), 0);
        console.log(`Actual Credits in DB: R$ ${totalCredits.toFixed(2)}`);

        if (Math.abs(totalCredits - totalComissao) > 0.1) {
            console.log('MISMATCH detected!');
        } else {
            console.log('Credits match 50% of sold items.');
        }

    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
    }
}

analyze();
