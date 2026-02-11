const db = require('../src/models');
const { Pessoa, Peca, Tamanho, Cor, Marca } = db;
const { Op } = require('sequelize');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const supplierName = process.argv.slice(2).join(' ');
const EXCEL_PATH = path.resolve(__dirname, '../pecas.xlsx');

if (!supplierName) {
    console.error('Uso: node scripts/supplier_report.js "NOME"');
    process.exit(1);
}

async function run() {
    console.log(`\n🔍 Gerando relatório para: "${supplierName}"...`);
    console.log('================================================================');

    try {
        await db.sequelize.authenticate();

        const supplier = await Pessoa.findOne({
            where: {
                nome: { [Op.iLike]: `%${supplierName}%` },
                is_fornecedor: true
            }
        });

        if (!supplier) {
            console.log(`❌ Fornecedor "${supplierName}" não encontrado.`);
            console.log('================================================================\n');
            return;
        }

        // 1. DATABASE DATA
        const pecas = await Peca.findAll({
            where: { fornecedorId: supplier.id },
            include: [
                { model: Tamanho, as: 'tamanho' },
                { model: Cor, as: 'cor' },
                { model: Marca, as: 'marca' }
            ],
            order: [['descricao_curta', 'ASC']]
        });

        // 2. EXCEL DATA RECONCILIATION
        let excelCount = 0;
        if (fs.existsSync(EXCEL_PATH)) {
            const workbook = xlsx.readFile(EXCEL_PATH);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = xlsx.utils.sheet_to_json(sheet);

            // Search in excel for the same supplier name or partial
            excelCount = data.filter(row => {
                const rowFornecedor = String(row.FORNECEDOR || '').toLowerCase();
                return rowFornecedor.includes(supplier.nome.toLowerCase()) ||
                    supplier.nome.toLowerCase().includes(rowFornecedor);
            }).length;
        }

        console.log(`FORNECEDOR:  ${supplier.nome}`);
        console.log(`----------------------------------------------------------------`);
        console.log(`CONCILIAÇÃO (PARIDADE):`);
        console.log(`- Total na Planilha (XLSX): ${excelCount}`);
        console.log(`- Total no Banco de Dados:  ${pecas.length}`);

        const status = excelCount === pecas.length ? '✅ OK' : '⚠️ Diferença Detectada';
        console.log(`- Status de Sincronia:      ${status}`);
        console.log(`----------------------------------------------------------------`);

        // 3. DETAILED LISTING
        let totalValue = 0;
        if (pecas.length === 0) {
            console.log('ℹ️ Nenhum produto encontrado no banco para este fornecedor.');
        } else {
            console.log(`LISTAGEM DETALHADA NO BANCO:`);
            console.log(`----------------------------------------------------------------`);
            console.log(`${'DESCRIÇÃO'.padEnd(35)} | ${'TAM'.padEnd(5)} | ${'COR'.padEnd(10)} | ${'PREÇO'.padStart(10)}`);
            console.log(`----------------------------------------------------------------`);

            pecas.forEach(p => {
                const desc = (p.descricao_curta || 'S/ Desc').substring(0, 33);
                const tam = p.tamanho ? p.tamanho.nome : '-';
                const cor = p.cor ? p.cor.nome : '-';
                const qtd = parseInt(p.quantidade) || 1;
                const precoNum = parseFloat(p.preco_venda || 0);
                const valorItem = precoNum * qtd;
                totalValue += valorItem;

                const precoStr = precoNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                console.log(`${desc.padEnd(35)} | ${tam.padEnd(5)} | ${cor.padEnd(10)} | ${precoStr.padStart(10)}`);
            });
        }

        console.log(`----------------------------------------------------------------`);
        console.log(`RESUMO FINAL GERAL:`);
        console.log(`FORNECEDOR:     | ${supplier.nome}`);
        console.log(`TOTAL DE PEÇAS: | ${pecas.length}`);
        console.log(`VALOR EM ESTOQUE| ${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
        console.log('================================================================\n');

    } catch (err) {
        console.error('❌ Erro ao gerar relatório:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

run();
