const db = require('../src/models');
const { Pessoa, Peca, Tamanho, Cor, Marca } = db;
const { Op } = require('sequelize');

const supplierName = process.argv.slice(2).join(' ');

if (!supplierName) {
    console.error('Uso: node scripts/supplier_report.js "NOME"');
    process.exit(1);
}

async function run() {
    try {
        await db.sequelize.authenticate();

        const supplier = await Pessoa.findOne({
            where: {
                nome: { [Op.iLike]: `%${supplierName}%` },
                is_fornecedor: true
            }
        });

        if (!supplier) {
            console.log(`Fornecedor "${supplierName}" não encontrado.`);
            return;
        }

        const pecas = await Peca.findAll({
            where: { fornecedorId: supplier.id },
            include: [
                { model: Tamanho, as: 'tamanho' },
                { model: Cor, as: 'cor' },
                { model: Marca, as: 'marca' }
            ],
            order: [['descricao_curta', 'ASC']]
        });

        console.log(`\n================================================================`);
        console.log(`RELATÓRIO DE PRODUTOS - FORNECEDOR`);
        console.log(`================================================================`);
        console.log(`Fornecedor: ${supplier.nome}`);
        console.log(`Total de Itens: ${pecas.length}`);
        console.log(`----------------------------------------------------------------`);

        let totalValue = 0;
        if (pecas.length === 0) {
            console.log('Nenhum produto encontrado.');
        } else {
            console.log(`${'DESCRIÇÃO'.padEnd(35)} | ${'TAM'.padEnd(5)} | ${'COR'.padEnd(10)} | ${'PREÇO'.padStart(10)}`);
            console.log(`----------------------------------------------------------------`);
            pecas.forEach(p => {
                const desc = (p.descricao_curta || 'S/ Desc').substring(0, 33);
                const tam = p.tamanho ? p.tamanho.nome : '-';
                const cor = p.cor ? p.cor.nome : '-';
                const precoNum = parseFloat(p.preco_venda || 0);
                totalValue += precoNum;
                const precoStr = precoNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                console.log(`${desc.padEnd(35)} | ${tam.padEnd(5)} | ${cor.padEnd(10)} | ${precoStr.padStart(10)}`);
            });
        }
        console.log(`----------------------------------------------------------------`);
        console.log(`RESUMO FINAL:`);
        console.log(`Quantidade Total de Produtos: ${pecas.length}`);
        console.log(`Valor Total em Produtos (Venda): ${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
        console.log(`================================================================\n`);

    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

run();
