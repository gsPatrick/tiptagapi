const path = require('path');
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const sequelize = new Sequelize(process.env.DATABASE_URL, { logging: false });

async function verify() {
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. Total items with data_entrada = 2025-12-24
    const [countResult] = await sequelize.query(
        "SELECT COUNT(*) as total FROM pecas WHERE DATE(data_entrada) = '2025-12-24' AND deleted_at IS NULL"
    );
    console.log('\n📊 Items with data_entrada = 2025-12-24:', countResult[0].total);

    // 2. Status breakdown
    const [statusResult] = await sequelize.query(
        "SELECT status, COUNT(*) as count FROM pecas WHERE DATE(data_entrada) = '2025-12-24' AND deleted_at IS NULL GROUP BY status ORDER BY count DESC"
    );
    console.log('\n📋 Status Breakdown:');
    statusResult.forEach(s => console.log('  -', s.status + ':', s.count));

    // 3. Sample records
    const [samples] = await sequelize.query(
        `SELECT p.id, p.descricao_curta, p.status, p.data_entrada, p.data_venda, pe.nome as fornecedor_nome 
         FROM pecas p 
         LEFT JOIN pessoas pe ON p."fornecedorId" = pe.id 
         WHERE DATE(p.data_entrada) = '2025-12-24' AND p.deleted_at IS NULL 
         LIMIT 5`
    );
    console.log('\n📝 Sample Records:');
    samples.forEach(s => console.log('  [' + s.status + ']', s.descricao_curta, '- Fornecedor:', s.fornecedor_nome));

    // 4. Count unique suppliers
    const [suppliersResult] = await sequelize.query(
        `SELECT COUNT(DISTINCT "fornecedorId") as unique_suppliers FROM pecas WHERE DATE(data_entrada) = '2025-12-24' AND deleted_at IS NULL`
    );
    console.log('\n👥 Unique Suppliers:', suppliersResult[0].unique_suppliers);

    // 5. Check specific normalized names
    console.log('\n✅ Checking Specific Normalized Suppliers:');
    const names = ['DENISE LIMA', 'LETICIA REGAZZINI', 'KELY LUZ', 'ALINE LIMA', 'LORENA LIMA'];
    for (const name of names) {
        const [result] = await sequelize.query(
            'SELECT id, nome FROM pessoas WHERE UPPER(nome) = :name AND deleted_at IS NULL',
            { replacements: { name: name.toUpperCase() } }
        );
        if (result.length > 0) {
            console.log('  ✅', name, '(ID:', result[0].id + ')');
        } else {
            console.log('  ❌', name, '- Not found');
        }
    }

    // 6. Verify supplier flags
    console.log('\n🔍 Checking Supplier Flags (is_fornecedor AND is_cliente):');
    const [flagCheck] = await sequelize.query(
        `SELECT COUNT(*) as correct_flags FROM pessoas 
         WHERE id IN (SELECT DISTINCT "fornecedorId" FROM pecas WHERE DATE(data_entrada) = '2025-12-24') 
         AND is_fornecedor = true AND is_cliente = true AND deleted_at IS NULL`
    );
    console.log('  Suppliers with correct AMBOS flags:', flagCheck[0].correct_flags);

    await sequelize.close();
    console.log('\n✅ Verification Complete!');
}
verify().catch(console.error);
