const { Pessoa, ContaCorrentePessoa, CreditoLoja, sequelize } = require('../src/models');
const { Op } = require('sequelize');
const fs = require('fs');

async function resetPreAprilBalances(dryRun = true) {
    console.log(`--- Reset Total Pré-Abril (Dry Run: ${dryRun}) ---`);
    
    const masterList = JSON.parse(fs.readFileSync('/tmp/master_supplier_reset.json', 'utf8'));

    let stats = {
        totalSuppliers: masterList.length,
        processed: 0,
        errors: 0,
        deletedRecords: 0,
        totalCreditValue: 0
    };

    for (const item of masterList) {
        const { id, name, val } = item;

        const supplier = await Pessoa.findByPk(id);
        if (!supplier) {
            console.error(`[ERROR] Supplier ID ${id} (${name}) not found. Skipping.`);
            stats.errors++;
            continue;
        }

        stats.processed++;
        console.log(`[RESET] ID: ${id.toString().padStart(4, '0')} | ${supplier.nome.padEnd(40)} | Novo Saldo Março: R$ ${val.toFixed(2).padStart(10)}`);

        if (!dryRun) {
            const transaction = await sequelize.transaction();
            try {
                // DELETE ALL HISTORY BEFORE APRIL 1st
                const deletedCC = await ContaCorrentePessoa.destroy({
                    where: {
                        pessoaId: id,
                        data_movimento: { [Op.lt]: '2026-04-01' }
                    },
                    transaction
                });

                const deletedCL = await CreditoLoja.destroy({
                    where: {
                        cliente_id: id,
                        createdAt: { [Op.lt]: '2026-04-01' }
                    },
                    transaction
                });

                stats.deletedRecords += (deletedCC + deletedCL);

                // Insert the FRESH START entry
                if (val !== 0) {
                    await ContaCorrentePessoa.create({
                        pessoaId: id,
                        tipo: val >= 0 ? 'CREDITO' : 'DEBITO',
                        valor: Math.abs(val),
                        data_movimento: '2026-03-31 12:00:00',
                        descricao: 'Saldo Inicial Consolidado (Reset Pré-Abril)'
                    }, { transaction });
                    stats.totalCreditValue += val;
                }
                await transaction.commit();
            } catch (err) {
                await transaction.rollback();
                console.error(`Error resetting ${supplier.nome}:`, err);
                stats.errors++;
            }
        }
    }

    console.log('\n--- RESET SUMMARY ---');
    console.log(`Total Suppliers: ${stats.totalSuppliers}`);
    console.log(`Successfully Processed: ${stats.processed}`);
    console.log(`Errors: ${stats.errors}`);
    if (!dryRun) {
        console.log(`Historical Records Deleted: ${stats.deletedRecords}`);
        console.log(`Total Credits Re-Applied: R$ ${stats.totalCreditValue.toFixed(2)}`);
    }
}

const isDryRun = process.argv[2] !== '--execute';
resetPreAprilBalances(isDryRun)
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
