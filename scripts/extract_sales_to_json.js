const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_PATH = '/Volumes/Lexar/trabalho/AgileProjects/Lorena_Garimponos&Loya/VENDAS COM VALORES ERRADOS.xls';
const JSON_OUTPUT = path.join(__dirname, 'vendas_corrigir.json');

async function extract() {
    try {
        console.log(`Reading Excel: ${EXCEL_PATH}`);
        const wb = xlsx.readFile(EXCEL_PATH);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);

        console.log(`Found ${rows.length} rows. Mapping to organized JSON...`);

        const organized = rows.map((row, index) => {
            // Mapping based on the preview observed earlier
            return {
                index: index + 1,
                data: row['Data'],
                codigo_pedido: String(row['ID Venda']),
                codigo_etiqueta: String(row['ID Peça']),
                descricao: row['Descrição'],
                valor_correto: parseFloat(row['Vlr Vendido'] || 0),
                repasse_correto: parseFloat(row['Repasse'] || 0),
                fornecedora: row['Fornecedora'],
                cliente: row['Cliente']
            };
        });

        fs.writeFileSync(JSON_OUTPUT, JSON.stringify(organized, null, 2));
        console.log(`\n✅ Extraction successful! JSON saved to: ${JSON_OUTPUT}`);
        console.log(`Summary: ${organized.length} items to fix.`);

    } catch (error) {
        console.error('Error during extraction:', error.message);
    }
}

extract();
