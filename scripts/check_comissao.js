const xlsx = require('xlsx');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '../pecas (2).xlsx');
const workbook = xlsx.readFile(EXCEL_FILE);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

console.log('Sample Row Data (First 3):');
rows.slice(0, 3).forEach((r, i) => {
    console.log(`Row ${i + 1}:`, {
        preco: r['preco'] || r['Preço'],
        comissao: r['comissao'] || r['Comissão'],
        custo: r['custo'],
        status: r['status']
    });
});

console.log('\nUnique Commission Values (Sample 10):');
const comissoes = new Set();
rows.forEach(r => {
    const c = r['comissao'] || r['Comissão'];
    if (c !== undefined) comissoes.add(c);
});
console.log(Array.from(comissoes).slice(0, 10));
