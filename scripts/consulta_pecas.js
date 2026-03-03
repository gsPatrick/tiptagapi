const db = require('../src/models');
const { Peca, Tamanho, Cor } = db;
const { Op } = require('sequelize');

async function run() {
    const searchTerm = process.argv[2];

    if (!searchTerm) {
        console.log('\n❌ Erro: Termo de pesquisa não fornecido.');
        console.log('Uso: node scripts/consulta_pecas.js "NOME DO PRODUTO"');
        console.log('Exemplo: node scripts/consulta_pecas.js "meia-calca"\n');
        process.exit(1);
    }

    console.log(`\n🔍 Pesquisando por: "${searchTerm}"...`);
    console.log('================================================================');

    try {
        await db.sequelize.authenticate();

        const pecas = await Peca.findAll({
            where: {
                descricao_curta: { [Op.iLike]: `%${searchTerm}%` },
                status: 'DISPONIVEL'
            },
            include: [
                { model: Tamanho, as: 'tamanho', attributes: ['nome'] },
                { model: Cor, as: 'cor', attributes: ['nome'] }
            ],
            attributes: ['id', 'descricao_curta', 'preco_venda', 'quantidade']
        });

        if (pecas.length === 0) {
            console.log('ℹ️ Nenhum item disponível encontrado com este nome.');
            console.log('================================================================\n');
            return;
        }

        // Agrupar por Tamanho e Cor
        const agrupado = {};
        let totalItens = 0;
        let totalValor = 0;

        pecas.forEach(p => {
            const tam = p.tamanho?.nome || 'U';
            const cor = p.cor?.nome || 'N/A';
            const chave = `${tam} | ${cor}`;

            if (!agrupado[chave]) {
                agrupado[chave] = {
                    quantidade: 0,
                    valor: 0,
                    exemplo: p.descricao_curta
                };
            }

            const qtd = parseInt(p.quantidade) || 1;
            agrupado[chave].quantidade += qtd;
            agrupado[chave].valor += (parseFloat(p.preco_venda) * qtd);

            totalItens += qtd;
            totalValor += (parseFloat(p.preco_venda) * qtd);
        });

        console.log(`RESULTADOS ENCONTRADOS (${pecas.length} SKUs):`);
        console.log('----------------------------------------------------------------');
        console.log('TAMANHO | COR             | QUANTIDADE | VALOR ESTIMADO');
        console.log('----------------------------------------------------------------');

        Object.entries(agrupado)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([chave, data]) => {
                const [tam, cor] = chave.split(' | ');
                const linha = `${tam.padEnd(7)} | ${cor.padEnd(15)} | ${data.quantidade.toString().padEnd(10)} | ${data.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
                console.log(linha);
            });

        console.log('----------------------------------------------------------------');
        console.log(`TOTAL GERAL:              | ${totalItens.toString().padEnd(10)} | ${totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
        console.log('================================================================\n');

    } catch (err) {
        console.error('❌ Erro ao consultar banco de dados:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

run();
