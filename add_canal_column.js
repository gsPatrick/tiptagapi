require('dotenv').config();
const { sequelize } = require('./src/models');

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const queryInterface = sequelize.getQueryInterface();

        // Check if column exists
        const tableDesc = await queryInterface.describeTable('fila_bot');
        if (!tableDesc.canal) {
            console.log('Adding column "canal" to "fila_bot"...');
            await queryInterface.addColumn('fila_bot', 'canal', {
                type: sequelize.Sequelize.ENUM('WHATSAPP', 'EMAIL'),
                allowNull: false,
                defaultValue: 'WHATSAPP'
            });
            console.log('Column "canal" added successfully.');
        } else {
            console.log('Column "canal" already exists.');
        }

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sequelize.close();
    }
}

migrate();
