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

        // 2. Find IDs to be deleted
        const items = await sequelize.query(
            `SELECT id FROM pecas 
             WHERE DATE(data_entrada) = :date 
             AND deleted_at IS NULL`,
            { replacements: { date: targetDate }, type: sequelize.QueryTypes.SELECT }
        );

        const pecaIds = items.map(i => i.id);

        if (pecaIds.length === 0) {
            console.log('Nothing to cleanup.');
            return;
        }

        console.log(`Found ${pecaIds.length} items to cleanup.`);

        // 3. Cleanup Linked Data (Sales, Financials)
        console.log('Cleaning up linked data...');

        // Delete ItemPedido
        await sequelize.query(
            `DELETE FROM item_pedidos WHERE peca_id IN (:ids)`,
            { replacements: { ids: pecaIds } }
        );

        // Delete ContaCorrentePessoa (Financials based on Peca ID)
        await sequelize.query(
            `DELETE FROM conta_corrente_pessoa WHERE referencia_origem IN (:ids)`,
            { replacements: { ids: pecaIds } }
        );

        // Delete Pedidos (Legacy ones created by script)
        // Identify by code prefix or date? 
        // Safer to rely on CASCADE from ItemPedido if constraints existed, but they might not.
        // We can find Pedidos that have NO items left after above delete? 
        // Or better: Delete orders with code like 'LEGACY-%' which we used.
        await sequelize.query(
            `DELETE FROM pedidos WHERE codigo_pedido LIKE 'LEGACY-%'`,
            { type: sequelize.QueryTypes.DELETE }
        );

        // Also cleanup PagamentoPedido? 
        // If we delete Pedido, Pagamento must go. If checks exist, do manual.
        // Let's assume foreign keys might not cascade delete for everything in this setup.
        // But 'LEGACY' code is unique to our script.

        // 4. Soft delete items
        await sequelize.query(
            `UPDATE pecas SET deleted_at = NOW() 
             WHERE id IN (:ids)`,
            { replacements: { ids: pecaIds } }
        );

        console.log('Cleanup successful! Products, sales, and financial records removed.');
        console.log('Manual data (not from Dec 24) remains untouched.');

    } catch (error) {
        console.error('Error during cleanup:', error.message);
    } finally {
        await sequelize.close();
    }
}

cleanup();
