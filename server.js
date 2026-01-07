require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/models');
const cronService = require('./src/jobs/cron');
const queueWorker = require('./src/jobs/queue.worker');
const syncJob = require('./src/jobs/sync.job');

const PORT = process.env.PORT || 3000;

// Start Cron Jobs
syncJob();

async function startServer() {
    try {
        // 1. Connect Database
        await sequelize.authenticate();
        console.log('Database connected!');

        // 2. Sync Models (User requested force: true)
        await sequelize.sync({ force: true });
        console.log('Models synced (Force: true)!');

        // 2.1 Create default user
        const { User } = require('./src/models');
        const adminPrincipal = await User.findOne({ where: { email: 'admin@alcateia.com' } });
        if (!adminPrincipal) {
            await User.create({
                nome: 'Alcateia Admin',
                email: 'admin@alcateia.com',
                senha_hash: 'alcateiaadmin123',
                role: 'ADMIN'
            });
            console.log('Default user created: admin@alcateia.com');
        }

        // 3. Init Background Jobs
        cronService.init();
        queueWorker.init();

        // 4. Start Express
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });

    } catch (err) {
        console.error('Unable to start server:', err);
        process.exit(1);
    }
}

startServer();
