const cron = require('node-cron');
const { FinanceiroService } = require('../features/financeiro/financeiro.service');
const financeiroService = new FinanceiroService();

const creditExpirationJob = () => {
    // Run every day at 00:01 AM
    cron.schedule('1 0 * * *', async () => {
        console.log('[CreditExpirationJob] Checking for expired store credits...');
        try {
            const result = await financeiroService.checkCreditosExpirados();
            if (result.count > 0) {
                console.log(`[CreditExpirationJob] Expired ${result.count} credits.`);
            } else {
                console.log('[CreditExpirationJob] No expired credits found.');
            }
        } catch (error) {
            console.error('[CreditExpirationJob] Error:', error.message);
        }
    });

    console.log('[CreditExpirationJob] Scheduled (Daily @ 00:01).');
};

module.exports = creditExpirationJob;
