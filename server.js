require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/models');
const cronService = require('./src/jobs/cron');
const queueWorker = require('./src/jobs/queue.worker');

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // 1. Connect Database
        await sequelize.authenticate();
        console.log('Database connected!');

        // 2. Sync Models (Alter for dev/updates)
        await sequelize.sync({ alter: true });
        console.log('Models synced!');

        // 2.1 Create default user
        const { User } = require('./src/models');
        const user = await User.findOne({ where: { email: 'patrick@gmail.com' } });
        if (!user) {
            await User.create({
                nome: 'Patrick',
                email: 'patrick@gmail.com',
                senha_hash: 'patrick123',
                role: 'ADMIN'
            });
            console.log('Default user created: patrick@gmail.com');
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
