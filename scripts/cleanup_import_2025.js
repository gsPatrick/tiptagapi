const path = require('path');
const dotenv = require('dotenv');
// Load environment variables manually
dotenv.config({ path: path.join(__dirname, '../.env') });

const { sequelize, Peca } = require('../src/models');

async function cleanup() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const targetDate = '2025-12-24';

        console.log(`Deleting items with data_entrada = ${targetDate}...`);

        const deleted = await Peca.destroy({
            where: sequelize.where(
                sequelize.fn('DATE', sequelize.col('data_entrada')),
                targetDate
            ),
            force: true // Hard delete to really clean up
        });

        console.log(`Deleted ${deleted} items.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

cleanup();
