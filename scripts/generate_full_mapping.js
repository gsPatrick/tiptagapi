const fs = require('fs');
const XLSX = require('xlsx');

// Load all pessoas from the dump
const allPessoas = JSON.parse(fs.readFileSync('/tmp/all_pessoas.json', 'utf8'));

// Load spreadsheet
const filePath = '/Volumes/Lexar/trabalho/AgileProjects/Lorena_Garimponos&Loya/planilhanova/CREDITOS 03-2026.ods';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
const rows = data.slice(1);

function normalize(str) {
    if (!str) return '';
    return str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-z0-9]/g, ' ')
        .trim();
}

const mapping = [];

rows.forEach(row => {
    const rawName = row[0];
    if (!rawName) return;

    const creditoVal = parseFloat(row[1]) || 0;
    const atualVal = row[2] !== undefined && row[2] !== null ? parseFloat(row[2]) : null;
    const targetValue = atualVal !== null ? atualVal : creditoVal;

    const cleanName = rawName.replace(/ FORN$/i, '').replace(/\d+$/, '').trim();
    const normSearch = normalize(cleanName);

    // Score based matching
    let bestMatch = null;
    let maxScore = 0;

    allPessoas.forEach(p => {
        const normP = normalize(p.nome);
        
        // Exact normalized match
        if (normP === normSearch) {
            bestMatch = p;
            maxScore = 100;
        } 
        // Substring match
        else if (normP.includes(normSearch) || normSearch.includes(normP)) {
            const score = (normSearch.length / normP.length) * 80;
            if (score > maxScore) {
                maxScore = score;
                bestMatch = p;
            }
        }
        // Parts match
        else {
            const parts = normSearch.split(' ');
            const pParts = normP.split(' ');
            let matches = 0;
            parts.forEach(part => {
                if (pParts.includes(part)) matches++;
            });
            const score = (matches / parts.length) * 70;
            if (score > maxScore && matches > 0) {
                maxScore = score;
                bestMatch = p;
            }
        }
    });

    mapping.push({
        spreadsheetName: rawName,
        targetValue,
        matchedNome: bestMatch ? bestMatch.nome : 'NÃO ENCONTRADO',
        matchedId: bestMatch ? bestMatch.id : '-',
        score: maxScore.toFixed(0)
    });
});

console.log('| Fornecedor Planilha | Valor Consolidado | Nome no Sistema | ID | Match % |');
console.log('| :--- | :--- | :--- | :--- | :--- |');
mapping.forEach(m => {
    console.log(`| ${m.spreadsheetName} | R$ ${m.targetValue.toFixed(2)} | ${m.matchedNome} | ${m.matchedId} | ${m.score}% |`);
});
