const xlsx = require('xlsx');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '../pecas (2).xlsx');
const workbook = xlsx.readFile(EXCEL_FILE);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

console.log('Sample Status Values:');
const statuses = new Set();
rows.forEach(r => {
    const s = r['status'] || r['Status'];
    if (s !== undefined) statuses.add(s);
});

console.log('Unique statuses in Excel:', Array.from(statuses));

// Check first 10 rows
console.log('\nFirst 10 rows status column:');
rows.slice(0, 10).forEach((r, i) => {
    console.log(`Row ${i + 1}: ${r['status']} (Type: ${typeof r['status']})`);
});
