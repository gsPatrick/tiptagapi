const cron = require('node-cron');
const automacaoService = require('../features/automacao/automacao.service');

class QueueWorker {
    init() {
        // Run every minute
        cron.schedule('* * * * *', async () => {
            await automacaoService.processarFila();
        });
        console.log('Queue Worker initialized (1-min interval).');
    }
}

module.exports = new QueueWorker();
