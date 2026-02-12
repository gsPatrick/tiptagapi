const path = require('path');
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

// Database Connection
const sequelize = process.env.DATABASE_URL
    ? new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        define: { underscored: true },
        dialectOptions: { ssl: false }
    })
    : new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            dialect: 'postgres',
            logging: false,
            define: { underscored: true }
        }
    );

async function verify() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const targetDate = '2025-12-24';

        // 1. Status distribution
        const [statusCounts] = await sequelize.query(
            `SELECT status, COUNT(*) as count, 
                    SUM(CAST(preco_venda AS DECIMAL)) as total_venda,
                    SUM(CAST(valor_comissao_loja AS DECIMAL)) as total_comissao,
                    SUM(CAST(valor_liquido_fornecedor AS DECIMAL)) as total_fornecedor
             FROM pecas 
             WHERE DATE(data_entrada) = :date AND deleted_at IS NULL 
             GROUP BY status`,
            { replacements: { date: targetDate } }
        );

        console.log('\n--- Financial & Status Summary ---');
        statusCounts.forEach(s => {
            console.log(`${s.status}: ${s.count} items`);
            console.log(`   Total Venda: R$ ${parseFloat(s.total_venda || 0).toFixed(2)}`);
            console.log(`   Comissão Loja (50%): R$ ${parseFloat(s.total_comissao || 0).toFixed(2)}`);
            console.log(`   Líquido Fornecedor (50%): R$ ${parseFloat(s.total_fornecedor || 0).toFixed(2)}`);
        });

        // 2. All unique suppliers in this import
        const [suppliers] = await sequelize.query(
            `SELECT DISTINCT pe.id, pe.nome 
             FROM pessoas pe
             JOIN pecas p ON p.fornecedor_id = pe.id
             WHERE DATE(p.data_entrada) = :date AND p.deleted_at IS NULL
             ORDER BY pe.nome ASC`,
            { replacements: { date: targetDate } }
        );

        console.log('\n--- Suppliers Processed ---');
        suppliers.forEach(s => console.log(`ID ${s.id}: ${s.nome}`));
        console.log(`\nTotal unique suppliers: ${suppliers.length}`);

    } catch (error) {
        console.error('Error during verification:', error);
    } finally {
        await sequelize.close();
    }
}

verify();
