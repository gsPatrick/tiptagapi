const path = require('path');
const dotenv = require('dotenv');

// Load environment variables manually if helpful, though models/index.js should do it too
dotenv.config({ path: path.join(__dirname, '../.env') });

const { sequelize, Peca, Pessoa } = require('../src/models');

async function verify() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const targetDate = '2025-12-24';

        // 1. Count Total Imported
        const count = await Peca.count({
            where: sequelize.where(
                sequelize.fn('DATE', sequelize.col('data_entrada')),
                targetDate
            )
        });
        console.log(`\nItems with data_entrada = ${targetDate}: ${count}`);

        // 2. Count by Status
        const statusCounts = await Peca.findAll({
            attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            where: sequelize.where(
                sequelize.fn('DATE', sequelize.col('data_entrada')),
                targetDate
            ),
            group: ['status']
        });
        console.log('\nStatus Breakdown:');
        statusCounts.forEach(s => console.log(`- ${s.status}: ${s.get('count')}`));

        // 3. Sample Check
        console.log('\nSample Records (2 of each status):');

        const statuses = statusCounts.map(s => s.status);

        for (const st of statuses) {
            const samples = await Peca.findAll({
                where: {
                    status: st,
                    [sequelize.Sequelize.Op.and]: sequelize.where(
                        sequelize.fn('DATE', sequelize.col('data_entrada')),
                        targetDate
                    )
                },
                limit: 2,
                include: [{ model: Pessoa, as: 'fornecedor', attributes: ['nome', 'is_fornecedor', 'is_cliente'] }]
            });

            samples.forEach(p => {
                console.log(`\n[${p.status}] ${p.descricao_curta}`);
                console.log(`  Entrada: ${p.data_entrada ? p.data_entrada.toISOString().split('T')[0] : 'N/A'}`);
                console.log(`  Venda: ${p.data_venda ? p.data_venda.toISOString().split('T')[0] : 'N/A'}`);
                console.log(`  Fornecedor: ${p.fornecedor?.nome} (F:${p.fornecedor?.is_fornecedor}, C:${p.fornecedor?.is_cliente})`);
            });
        }

        // 4. Verify Specific Normalized Suppliers
        console.log('\nChecking Specific Normalized Suppliers:');
        const expectedNames = [
            'ALINE ORNAGUI',
            'DENISE LIMA',
            'LUANA VERONESI',
            'JULIANA SIMÕES',
            'KELLY LUZ',
            'LETICIA REGAZZINI',
            'MARIA AP. DE CARVALHO ALMEIDA'
        ];

        for (const name of expectedNames) {
            const p = await Pessoa.findOne({
                where: sequelize.where(
                    sequelize.fn('upper', sequelize.col('nome')),
                    name
                )
            });
            if (p) {
                console.log(`✅ Found: ${name} (ID: ${p.id})`);
            } else {
                console.log(`❌ Missing: ${name}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

verify();
