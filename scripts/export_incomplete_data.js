const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const EXCEL_PATH = path.resolve(__dirname, '../pecas.xlsx');
const OUTPUT_PATH = path.resolve(__dirname, '../itens_incompletos_na_planilha.csv');

async function run() {
    console.log('\n--- Exporting Incomplete Items from Excel ---');

    try {
        if (!fs.existsSync(EXCEL_PATH)) {
            throw new Error(`Arquivo ${EXCEL_PATH} não encontrado.`);
        }

        const workbook = xlsx.readFile(EXCEL_PATH);
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        const incompleteRows = [];

        data.forEach((row, index) => {
            const missing = [];
            if (!row.cor || row.cor.toString().trim() === '') missing.push('Cor');
            if (!row.marca || row.marca.toString().trim() === '') missing.push('Marca');

            if (missing.length > 0) {
                incompleteRows.push({
                    'Linha na Planilha': index + 2,
                    'ID Original': row.ID || '',
                    'Fornecedor': row.fornecedor || '',
                    'Descrição': row.desc || row.descricao || 'Sem Descrição',
                    'Faltando': missing.join(' e ')
                });
            }
        });

        console.log(`Identificados ${incompleteRows.length} itens incompletos.`);

        if (incompleteRows.length > 0) {
            const worksheet = xlsx.utils.json_to_sheet(incompleteRows);
            const csv = xlsx.utils.sheet_to_csv(worksheet);
            fs.writeFileSync(OUTPUT_PATH, csv);
            console.log(`Relatório gerado com sucesso em: ${OUTPUT_PATH}`);
        } else {
            console.log('Nenhum item incompleto encontrado logicamente (improvável baseado na auditoria anterior).');
        }

    } catch (err) {
        console.error('Erro ao exportar:', err.message);
    }
}

run();
