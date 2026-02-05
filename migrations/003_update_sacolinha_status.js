/**
 * Migration: Update sacolinhas status ENUM
 * Adds new status values: PRONTA, ENVIADA
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        // PostgreSQL: Alter enum type to add new values
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_sacolinhas_status" ADD VALUE IF NOT EXISTS 'PRONTA';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_sacolinhas_status" ADD VALUE IF NOT EXISTS 'ENVIADA';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_sacolinhas_status" ADD VALUE IF NOT EXISTS 'FECHADA';
        `);
        console.log('[MIGRATION] Added PRONTA, ENVIADA, FECHADA to sacolinhas status enum');
    },

    async down(queryInterface, Sequelize) {
        // Cannot remove values from PostgreSQL enum without recreating the type
        console.log('[MIGRATION] Rollback not supported for enum value removal');
    }
};
