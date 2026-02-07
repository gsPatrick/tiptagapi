require('dotenv').config();
const { sequelize } = require('../src/models');

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Database connected for migration.');

        const queryInterface = sequelize.getQueryInterface();
        const tableName = 'pessoas';
        const columnName = 'foto';

        // Check if column exists
        const tableDesc = await queryInterface.describeTable(tableName);
        if (!tableDesc[columnName]) {
            console.log(`Adding column "${columnName}" to "${tableName}"...`);
            await queryInterface.addColumn(tableName, columnName, {
                type: sequelize.Sequelize.STRING,
                allowNull: true,
            });
            console.log(`Column "${columnName}" added successfully.`);
        } else {
            console.log(`Column "${columnName}" already exists in "${tableName}".`);
        }

    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

migrate();
