require('dotenv').config();
const { sequelize } = require('../src/models');

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Database connected for migration.');

        const queryInterface = sequelize.getQueryInterface();

        // PostgreSQL: Alter enum type to add new values
        // Note: Using IF NOT EXISTS (requires PG 9.6+)
        console.log('Adding new values to enum_sacolinhas_status...');

        await sequelize.query(`ALTER TYPE "enum_sacolinhas_status" ADD VALUE IF NOT EXISTS 'PRONTA'`);
        await sequelize.query(`ALTER TYPE "enum_sacolinhas_status" ADD VALUE IF NOT EXISTS 'ENVIADA'`);
        await sequelize.query(`ALTER TYPE "enum_sacolinhas_status" ADD VALUE IF NOT EXISTS 'FECHADA'`);

        console.log('[MIGRATION] Added PRONTA, ENVIADA, FECHADA to sacolinhas status enum successfully.');

    } catch (err) {
        console.error('Migration failed:', err.message);
        // We don't exit(1) if it's already added to avoid breaking the startup loop
        if (err.message.includes('already exists')) {
            console.log('Values already exist in ENUM, continuing...');
        } else {
            process.exit(1);
        }
    } finally {
        await sequelize.close();
    }
}

migrate();
