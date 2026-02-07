const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const db = require('../src/models');
const { Peca, Pessoa, Cor, Tamanho } = db;

const EXCEL_PATH = path.resolve(__dirname, '../pecas.xlsx');

async function run() {
    console.log('\n--- Data Audit: Incomplete Piece Records ---');

    try {
        await db.sequelize.authenticate();
        console.log('1. Auditing Database...');

        const incompleteDB = await Peca.findAll({
            where: {
                [db.Sequelize.Op.or]: [
                    { fornecedorId: null },
                    { tamanhoId: null },
                    { corId: null }
                ]
            },
            include: ['fornecedor', 'tamanho', 'cor'],
            paranoid: false // Include deleted if necessary, but usually just active ones
        });

        console.log(`Found ${incompleteDB.length} incomplete pieces in the database.`);

        if (incompleteDB.length > 0) {
            console.log('\nSample Incomplete DB Records:');
            incompleteDB.slice(0, 10).forEach(p => {
                const missing = [];
                if (!p.fornecedorId) missing.push('Fornecedor');
                if (!p.tamanhoId) missing.push('Tamanho');
                if (!p.corId) missing.push('Cor');
                console.log(`- [${p.codigo_etiqueta}] ${p.descricao_curta} (Missing: ${missing.join(', ')})`);
            });
        }

        console.log('\n2. Auditing Excel Spreadsheet...');
        if (!fs.existsSync(EXCEL_PATH)) {
            console.error('Excel file not found.');
            return;
        }

        const workbook = xlsx.readFile(EXCEL_PATH);
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        const incompleteExcel = [];
        data.forEach((row, index) => {
            const missing = [];
            const fornecedor = row.fornecedor;
            const tamanho = row.tam || row.tamanho;
            const cor = row.cor;

            if (!fornecedor) missing.push('Fornecedor');
            if (!tamanho) missing.push('Tamanho');
            if (!cor) missing.push('Cor');

            if (missing.length > 0) {
                incompleteExcel.push({
                    row: index + 2, // 1-based + 1 for header
                    excelId: row.ID,
                    descricao: row.desc || row.descricao || 'Sem Descrição',
                    missing
                });
            }
        });

        console.log(`Found ${incompleteExcel.length} incomplete rows in the Excel file.`);

        if (incompleteExcel.length > 0) {
            console.log('\nSample Incomplete Excel Rows:');
            incompleteExcel.slice(0, 10).forEach(row => {
                console.log(`- Row ${row.row} (ID: ${row.excelId}): ${row.descricao} (Missing: ${row.missing.join(', ')})`);
            });
        }

        // Final Comparison
        console.log('\n--- Conclusion ---');
        if (incompleteDB.length === incompleteExcel.length) {
            console.log('MATCH: The number of incomplete records in DB matches the number of incomplete rows in Excel.');
            console.log('This confirms the data is missing in the source file.');
        } else {
            console.log(`MISMATCH: DB has ${incompleteDB.length} incomplete vs Excel has ${incompleteExcel.length}.`);
            console.log('Double check if some imports failed or if data was modified manually.');
        }

    } catch (err) {
        console.error('Audit Error:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

run();
