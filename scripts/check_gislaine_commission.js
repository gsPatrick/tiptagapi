const xlsx = require('xlsx');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '../pecas (2).xlsx');
const workbook = xlsx.readFile(EXCEL_FILE);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

const gislaineRows = rows.filter(r => {
    const p = r['fornecedor'] || r['Fornecedor'];
    return p && p.toString().toUpperCase().includes('GISLAINE APARECIDA');
});

console.log(`Found ${gislaineRows.length} rows for Gislaine.`);
const commissions = new Set();
const prices = [];

gislaineRows.forEach(r => {
    const com = r['comissao'] || r['Comissao'];
    commissions.add(com);
    prices.push(r['preco']);
});

console.log('Unique Commission values:', Array.from(commissions));
console.log('Sample Prices:', prices.slice(0, 10));
