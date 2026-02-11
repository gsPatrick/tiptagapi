const db = require('../src/models');
const { Peca } = db;
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const EXCEL_PATH = path.resolve(__dirname, '../pecas.xlsx');

async function run() {
    console.log('\n================================================================');
    console.log('RELATÓRIO DE CONCILIAÇÃO: BANCO DE DADOS VS PLANILHA');
    console.log('================================================================');

    try {
        // 1. DATABASE COUNT
        await db.sequelize.authenticate();
        const dbTotal = await Peca.count();

        // 2. EXCEL COUNT
        let excelTotal = 0;
        if (fs.existsSync(EXCEL_PATH)) {
            const workbook = xlsx.readFile(EXCEL_PATH);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = xlsx.utils.sheet_to_json(sheet);
            excelTotal = data.length;
        } else {
            console.log('⚠️ Planilha pecas.xlsx não encontrada.');
        }

        // 3. DISPLAY REPORT
        console.log(`FONTE DE DADOS      | TOTAL DE PRODUTOS | STATUS`);
        console.log(`----------------------------------------------------------------`);

        const status = dbTotal === excelTotal ? '✅ SINCRONIZADO' : '⚠️ DIVERGENTE';

        console.log(`PLANILHA (EXCEL)    | ${excelTotal.toString().padEnd(17)} | ORIGEM`);
        console.log(`BANCO DE DADOS (DB) | ${dbTotal.toString().padEnd(17)} | DESTINO`);
        console.log(`----------------------------------------------------------------`);
        console.log(`RESULTADO FINAL     | ${status}`);
        console.log('================================================================\n');

    } catch (err) {
        console.error('❌ Erro durante a conciliação:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

run();
