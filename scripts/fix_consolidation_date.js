const { ContaCorrentePessoa } = require('../src/models');
const { Op } = require('sequelize');

async function fixTimezoneIssue() {
    console.log('--- Fixing Timezone Issue for Consolidated Credits ---');
    
    // Update all entries with the specific consolidated description
    const [updatedCount] = await ContaCorrentePessoa.update(
        { data_movimento: '2026-03-31 12:00:00' },
        {
            where: {
                descricao: 'Consolidado Março/2026 (Planilha)'
            }
        }
    );

    console.log(`Successfully updated ${updatedCount} records to the correct March date.`);
}

fixTimezoneIssue().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
