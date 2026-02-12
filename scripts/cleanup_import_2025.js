const path = require('path');
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false
    }
);

async function cleanup() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // Target exactly the date/time used in the import script
        const targetDate = '2025-12-24';
        const targetDateTime = '2025-12-24 12:00:00+00';

        // 1. Count items to be deleted
        const [countResult] = await sequelize.query(
            `SELECT COUNT(*) as total FROM pecas 
             WHERE DATE(data_entrada) = :date 
             AND deleted_at IS NULL`,
            { replacements: { date: targetDate } }
        );

        const total = countResult[0].total;
        console.log(`Found ${total} items from the import date (${targetDate}) to be cleaned up.`);

        if (total === 0) {
            console.log('Nothing to cleanup.');
            return;
        }

        // 2. Soft delete items
        await sequelize.query(
            `UPDATE pecas SET deleted_at = NOW() 
             WHERE DATE(data_entrada) = :date 
             AND deleted_at IS NULL`,
            { replacements: { date: targetDate } }
        );

        console.log('Cleanup successful! Only products from the specified import date were removed.');
        console.log('Manual data remains untouched.');

    } catch (error) {
        console.error('Error during cleanup:', error.message);
    } finally {
        await sequelize.close();
    }
}

cleanup();
