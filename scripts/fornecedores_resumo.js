const db = require('../src/models');
const { Pessoa, Peca } = db;

async function run() {
    console.log('\n================================================================');
    console.log('RESUMO ESTRATÉGICO POR FORNECEDOR');
    console.log('================================================================');

    try {
        await db.sequelize.authenticate();

        const data = await Pessoa.findAll({
            where: { is_fornecedor: true },
            attributes: ['id', 'nome'],
            include: [{
                model: Peca,
                as: 'pecasFornecidas', // Correct alias from associations
                attributes: ['id', 'preco_venda', 'quantidade']
            }],
            order: [['nome', 'ASC']]
        });

        if (data.length === 0) {
            console.log('Nenhum fornecedor cadastrado.');
            return;
        }

        console.log(`${'FORNECEDOR'.padEnd(35)} | ${'ITENS'.padStart(8)} | ${'VALOR TOTAL'.padStart(15)}`);
        console.log(`----------------------------------------------------------------`);

        let grandTotalItems = 0;
        let grandTotalValue = 0;
        let countFornecedoresComEstoque = 0;

        data.forEach(f => {
            const pecas = f.pecasFornecidas || [];
            if (pecas.length === 0) return; // Skip suppliers with no items for this clean summary

            countFornecedoresComEstoque++;
            const totalItems = pecas.reduce((sum, p) => sum + (parseInt(p.quantidade) || 1), 0);
            const totalValue = pecas.reduce((sum, p) => sum + (parseFloat(p.preco_venda || 0) * (parseInt(p.quantidade) || 1)), 0);

            grandTotalItems += totalItems;
            grandTotalValue += totalValue;

            const nome = f.nome.substring(0, 33);
            const valStr = totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            console.log(`${nome.padEnd(35)} | ${totalItems.toString().padStart(8)} | ${valStr.padStart(15)}`);
        });

        console.log(`----------------------------------------------------------------`);
        console.log(`RESUMO GERAL:`);
        console.log(`- Fornecedores Ativos com Estoque: ${countFornecedoresComEstoque}`);
        console.log(`- Total de Peças no Sistema: ${grandTotalItems}`);
        console.log(`- Valor Total em Estoque (PV): ${grandTotalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
        console.log(`================================================================\n`);

    } catch (err) {
        console.error('Erro ao gerar resumo:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

run();
