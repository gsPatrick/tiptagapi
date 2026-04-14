const { Pessoa, ContaCorrentePessoa, CreditoLoja, sequelize } = require('../src/models');
const { Op } = require('sequelize');
const XLSX = require('xlsx');

async function adjustRemainingCredits(dryRun = true) {
    console.log(`--- Final Credit Adjustment (Dry Run: ${dryRun}) ---`);
    
    const filePath = '../créditos a ajustar.ods';
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const rows = data.slice(1);
    let stats = {
        totalRows: rows.length,
        processed: 0,
        errors: 0,
        totalCreditValue: 0
    };

    for (const row of rows) {
        const rawName = row[0];
        const creditoVal = parseFloat(row[1]) || 0;
        const atualVal = row[2] !== undefined && row[2] !== null ? parseFloat(row[2]) : null;
        const targetValue = atualVal !== null ? atualVal : creditoVal;
        const personId = parseInt(row[3]);

        if (!personId || isNaN(personId)) {
            console.error(`[ERROR] Row for ${rawName} has no valid ID. Skipping.`);
            stats.errors++;
            continue;
        }

        const supplier = await Pessoa.findByPk(personId);
        if (!supplier) {
            console.error(`[ERROR] Supplier with ID ${personId} (${rawName}) not found in DB!`);
            stats.errors++;
            continue;
        }

        stats.processed++;
        console.log(`[OK] ID: ${personId.toString().padStart(4, '0')} | ${supplier.nome.padEnd(40)} | Valor: R$ ${targetValue.toFixed(2).padStart(10)}`);

        if (!dryRun) {
            const transaction = await sequelize.transaction();
            try {
                // Delete ANY March 2026 record for this supplier (to reset)
                await ContaCorrentePessoa.destroy({
                    where: {
                        pessoaId: supplier.id,
                        data_movimento: { [Op.gte]: '2026-03-01', [Op.lt]: '2026-04-01' }
                    },
                    transaction
                });

                await CreditoLoja.destroy({
                    where: {
                        cliente_id: supplier.id,
                        createdAt: { [Op.gte]: '2026-03-01', [Op.lt]: '2026-04-01' }
                    },
                    transaction
                });

                if (targetValue !== 0) {
                    await ContaCorrentePessoa.create({
                        pessoaId: supplier.id,
                        tipo: targetValue >= 0 ? 'CREDITO' : 'DEBITO',
                        valor: Math.abs(targetValue),
                        data_movimento: '2026-03-31 12:00:00', // Noon to avoid timezone shift
                        descricao: 'Consolidado Março/2026 (Planilha Final)'
                    }, { transaction });
                    stats.totalCreditValue += targetValue;
                }
                await transaction.commit();
            } catch (err) {
                await transaction.rollback();
                console.error(`Error processing ${supplier.nome}:`, err);
                stats.errors++;
            }
        }
    }

    console.log('\n--- FINAL SUMMARY ---');
    console.log(`Total rows: ${stats.totalRows}`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`Errors: ${stats.errors}`);
    if (!dryRun) {
        console.log(`Total Credits Applied: R$ ${stats.totalCreditValue.toFixed(2)}`);
    }
}

const isDryRun = process.argv[2] !== '--execute';
adjustRemainingCredits(isDryRun)
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
