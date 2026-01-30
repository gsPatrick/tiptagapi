const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const EXCEL_PATH = path.resolve(__dirname, '../pecas.xlsx');

if (!fs.existsSync(EXCEL_PATH)) {
    console.error('File not found:', EXCEL_PATH);
    process.exit(1);
}

try {
    const workbook = xlsx.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log('JSON_START');
    console.log(JSON.stringify({
        sheetName,
        totalRows: data.length,
        headers: data.length > 0 ? Object.keys(data[0]) : [],
        sample: data.length > 0 ? data[0] : null
    }, null, 2));
    console.log('JSON_END');
} catch (err) {
    console.error('Error reading Excel:', err.message);
}
