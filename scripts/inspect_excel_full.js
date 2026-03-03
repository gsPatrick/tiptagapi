const xlsx = require('xlsx');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '../pecas (2).xlsx');
const workbook = xlsx.readFile(EXCEL_FILE);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

console.log(`Total rows in JSON: ${rows.length}`);

if (rows.length > 0) {
    console.log('Excel Headers (Keys):', Object.keys(rows[0]));
    console.log('First Row:', rows[0]);
}

// Check for columns that might look like "10 100" etc
const keys = Object.keys(rows[0]);
const systemKey = keys.find(k => k.toLowerCase().includes('sistem') || k.toLowerCase().includes('num'));
if (systemKey) {
    console.log(`Potential System Column found: ${systemKey}`);
    console.log(`Sample values:`, rows.slice(0, 5).map(r => r[systemKey]));
}

// Count non-empty values for key columns
const stats = {
    fornecedor: 0,
    descricao: 0,
    status: 0,
    preco: 0
};

rows.forEach(row => {
    if (row['fornecedor'] || row['Fornecedor']) stats.fornecedor++;
    if (row['descricao'] || row['descrição'] || row['Descrição'] || row['Descricao']) stats.descricao++;
    if (row['status'] || row['Status']) stats.status++;
    if (row['preco'] || row['preço'] || row['Preço'] || row['Preco']) stats.preco++;
});

console.log('Statistics of non-empty columns:', stats);

// Find any row that has a provider but no description or vice versa
const anomalies = rows.filter(r => (r['fornecedor'] && !r['descricao']) || (!r['fornecedor'] && r['descricao']));
console.log(`Rows with anomalies (missing either provider or description): ${anomalies.length}`);

// Sample of unique providers
const providers = new Set();
rows.forEach(r => {
    const p = r['fornecedor'] || r['Fornecedor'];
    if (p) providers.add(p.toString().trim().toUpperCase());
});
console.log(`Total unique providers in Excel: ${providers.size}`);
console.log('Sample of providers:', Array.from(providers).slice(0, 20));
