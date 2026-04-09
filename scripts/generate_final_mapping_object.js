const fs = require('fs');
const XLSX = require('xlsx');

const allPessoas = JSON.parse(fs.readFileSync('/tmp/all_pessoas.json', 'utf8'));

const filePath = '/Volumes/Lexar/trabalho/AgileProjects/Lorena_Garimponos&Loya/planilhanova/CREDITOS 03-2026.ods';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
const rows = data.slice(1);

const excludeList = [
    'ANA LAURA GUIMARAES FORN',
    'FERNANDA PEREIRA GUIMARÃES FORN',
    'ANA MARIA CARVALHO FORN',
    'ANA MARIA MALVEZI FORN',
    'thalita maria',
    'GISLAINE APARECIDA CRUNIEL FORN',
    'maria aparecida',
    'monise soares',
    'roberta fereira',
    'mayara da silva',
    'thifani'
];

const manualMatches = {};
const pending = [];

rows.forEach(row => {
    const rawName = row[0];
    if (!rawName) return;

    if (excludeList.includes(rawName)) {
        pending.push(rawName);
        return;
    }

    const cleanName = rawName.replace(/ FORN$/i, '').replace(/\d+$/, '').trim();
    
    // Try to find exact match in DB (ignoring " FORN")
    let match = allPessoas.find(p => {
        const pClean = p.nome.replace(/ FORN$/i, '').replace(/\d+$/, '').trim();
        return pClean.toLowerCase() === cleanName.toLowerCase();
    });

    if (match) {
        manualMatches[rawName] = match.id;
    } else {
        // Broad search
        const broadMatches = allPessoas.filter(p => p.nome.toLowerCase().includes(cleanName.toLowerCase()));
        if (broadMatches.length === 1) {
            manualMatches[rawName] = broadMatches[0].id;
        } else {
            pending.push(rawName);
        }
    }
});

console.log('const manualMatches = ' + JSON.stringify(manualMatches, null, 4) + ';');
console.log('\nconst excludeList = ' + JSON.stringify(pending, null, 4) + ';');
