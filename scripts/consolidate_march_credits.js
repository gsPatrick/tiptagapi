const { Pessoa, ContaCorrentePessoa, CreditoLoja, sequelize } = require('../src/models');
const { Op } = require('sequelize');
const XLSX = require('xlsx');

/**
 * Script to consolidate supplier credits for March 2026 based on a spreadsheet.
 * Deletes all transactions in March 2026 for the listed suppliers and replaces 
 * them with a single consolidated entry.
 */

async function consolidateMarchCredits(dryRun = true) {
    console.log(`--- Consolidation of March 2026 Credits (Dry Run: ${dryRun}) ---`);
    
    const filePath = '/Volumes/Lexar/trabalho/AgileProjects/Lorena_Garimponos&Loya/planilhanova/CREDITOS 03-2026.ods';
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const manualMatches = {
        "ADRIANA COSER FORN": 25,
        "ALINE LIMA FORN": 115,
        "AMANDA SANCHEZ FORN": 150,
        "ANA LIDIA ZANI FORN": 232,
        "ANA LYCIA FORN": 227,
        "ANA PAULA BRAQUIAO FORN": 255,
        "ANDREIA SANTOS FORN": 314,
        "ANINHA DAVOLI FORN": 340,
        "AUDINE FORN": 375,
        "BRUNA BIANCHI FORN": 436,
        "CAROL MARQUES FORN": 547,
        "CLAUDETE AP EDUARDO FARAH FORN": 623,
        "CLAUDIA ZIEMELS": 649,
        "CRIS ARENGHI FORN": 677,
        "CRISTIANE MARCELI CRUZ FORN": 694,
        "DANIELE ALBANO FORN": 758,
        "DANILA COSER FORN": 777,
        "DAYANE RIBEIRO FORN": 789,
        "DEBORA MODENA FORN": 800,
        "DENISE LIMA FORN": 809,
        "DORIS VIERA FORN": 849,
        "ELAINE FERREIRA SANTOS FORN": 910,
        "ELIANE RIBEIRO DO PRADO FORN": 953,
        "ELLEN NICCIOLI FORN": 988,
        "FABIANA CREMUNINI FORN": 1049,
        "GABRIELA BATISTA": 1182,
        "GABRIELA PEDROTTI FORN": 1199,
        "GABRIELE PASSERI PEREIRA": 1207,
        "GARIMPO LORENA": 1213,
        "GIOVANNA SHIOTA": 2544,
        "GISELEMELLO": 1254,
        "HANNA KARIN ANDERSON FORN 297": 1297,
        "JOYCE ARCURI FORN": 1542,
        "JULIANA SIMOES FORN": 1597,
        "KARINE MARÇOLA": 2475,
        "KELLY LUZ": 1686,
        "LISA": 195,
        "LORENA LIMA": 2494,
        "LUANA VERONEZI": 1885,
        "luma coser": 1994,
        "marcella benatti": 2055,
        "maria do carmo": 2164,
        "marli morelli": 2598,
        "mayara pereira": 2279,
        "michele baleck": 2282,
        "michele rodrigues": 2592,
        "patricia brandão": 2521,
        "renata mendes": 2554,
        "rosangela pavan": 2358,
        "sabrina zorzetto": 2375,
        "silvia baptista": 2397,
        "silvia": 275,
        "sueli vanilda": 2418,
        "vanessa araujo": 2452,
        "walkyria": 2462,
        "wanessa": 2463
    };

    const excludeList = [
        "ANA LAURA GUIMARAES FORN", "ANA MARIA CARVALHO FORN", "ANA MARIA MALVEZI FORN",
        "FERNANDA PEREIRA GUIMARÃES FORN", "GISLAINE APARECIDA CRUNIEL FORN",
        "KAREN FREITAS", "LETICIA BUENO ARRUDA", "luciana bazani", "lucineia",
        "maria aparecida", "mayara da silva", "monise soares", "roberta fereira",
        "rosana carvalho", "rosangela zinetti", "sandra kussonoki", "simone puglieli",
        "thaissa acencio", "thalita maria", "thifani"
    ];

    const rows = data.slice(1);
    let stats = {
        totalRows: rows.length,
        processed: 0,
        skipped: 0,
        deletedRecords: 0,
        insertedRecords: 0,
        totalCreditValue: 0
    };

    for (const row of rows) {
        const rawName = row[0];
        if (!rawName) continue;

        if (excludeList.includes(rawName)) {
            console.warn(`[SKIPPED] ${rawName} is on the verification list.`);
            stats.skipped++;
            continue;
        }

        const personId = manualMatches[rawName];
        if (!personId) {
            console.error(`[ERROR] No mapping found for ${rawName}. Skipping.`);
            stats.skipped++;
            continue;
        }

        const creditoVal = parseFloat(row[1]) || 0;
        const atualVal = row[2] !== undefined && row[2] !== null ? parseFloat(row[2]) : null;
        const targetValue = atualVal !== null ? atualVal : creditoVal;

        const supplier = await Pessoa.findByPk(personId);
        if (!supplier) {
            console.error(`[ERROR] Supplier with ID ${personId} not found in DB!`);
            stats.skipped++;
            continue;
        }

        stats.processed++;
        console.log(`[OK] ${rawName} -> ${supplier.nome} (ID: ${supplier.id}) | R$ ${targetValue.toFixed(2)}`);

        if (!dryRun) {
            const transaction = await sequelize.transaction();
            try {
                const deletedCC = await ContaCorrentePessoa.destroy({
                    where: {
                        pessoaId: supplier.id,
                        data_movimento: { [Op.gte]: '2026-03-01', [Op.lt]: '2026-04-01' }
                    },
                    transaction
                });

                const deletedCL = await CreditoLoja.destroy({
                    where: {
                        cliente_id: supplier.id,
                        createdAt: { [Op.gte]: '2026-03-01', [Op.lt]: '2026-04-01' }
                    },
                    transaction
                });

                stats.deletedRecords += (deletedCC + deletedCL);

                if (targetValue !== 0) {
                    await ContaCorrentePessoa.create({
                        pessoaId: supplier.id,
                        tipo: targetValue >= 0 ? 'CREDITO' : 'DEBITO',
                        valor: Math.abs(targetValue),
                        data_movimento: '2026-03-31 23:59:59',
                        descricao: 'Consolidado Março/2026 (Planilha)'
                    }, { transaction });
                    stats.insertedRecords++;
                    stats.totalCreditValue += targetValue;
                }
                await transaction.commit();
            } catch (err) {
                await transaction.rollback();
                console.error(`Error processing ${supplier.nome}:`, err);
            }
        }
    }

    console.log('\n--- FINAL CONSOLIDATION SUMMARY ---');
    console.log(`Total rows in sheet: ${stats.totalRows}`);
    console.log(`Successfully mapped: ${stats.processed}`);
    console.log(`Skipped for verification: ${stats.skipped}`);
    if (!dryRun) {
        console.log(`Records Deleted: ${stats.deletedRecords}`);
        console.log(`Records Inserted: ${stats.insertedRecords}`);
        console.log(`Total New Credits Applied: R$ ${stats.totalCreditValue.toFixed(2)}`);
    }
}

const isDryRun = process.argv[2] !== '--execute';
consolidateMarchCredits(isDryRun)
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
