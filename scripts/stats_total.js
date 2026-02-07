const db = require('../src/models');
const { Peca, Pessoa } = db;

async function run() {
    console.log('\n================================================================');
    console.log('ESTATÍSTICAS GERAIS DO SISTEMA');
    console.log('================================================================');

    try {
        await db.sequelize.authenticate();

        // 1. Pessoas
        const totalPessoas = await Pessoa.count();
        const totalClientes = await Pessoa.count({ where: { is_cliente: true } });
        const totalFornecedores = await Pessoa.count({ where: { is_fornecedor: true } });

        // 2. Peças e Valores
        const totalPecas = await Peca.count();
        const totalEstoque = await Peca.sum('quantidade') || 0;

        // Sum using attributes to avoid literal issues with .sum()
        const valorVendaResult = await Peca.findAll({
            attributes: [
                [db.sequelize.fn('SUM', db.sequelize.literal('quantidade * preco_venda')), 'total']
            ],
            raw: true
        });
        const valorVendaTotal = parseFloat(valorVendaResult[0].total) || 0;

        const valorCustoResult = await Peca.findAll({
            attributes: [
                [db.sequelize.fn('SUM', db.sequelize.literal('quantidade * preco_custo')), 'total']
            ],
            raw: true
        });
        const valorCustoTotal = parseFloat(valorCustoResult[0].total) || 0;

        console.log(`CADASTROS (CRM):`);
        console.log(`- Total de Pessoas: ${totalPessoas}`);
        console.log(`- Clientes: ${totalClientes}`);
        console.log(`- Fornecedores: ${totalFornecedores}`);
        console.log(`----------------------------------------------------------------`);

        console.log(`ESTOQUE E FINANCEIRO:`);
        console.log(`- Total de Itens (SKUs): ${totalPecas}`);
        console.log(`- Quantidade Total de Peças em Estoque: ${totalEstoque}`);
        console.log(`- Valor Total em Estoque (PV): ${valorVendaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
        console.log(`- Valor Total em Estoque (PC): ${valorCustoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
        console.log(`================================================================\n`);

    } catch (err) {
        console.error('Erro ao gerar estatísticas:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

run();
