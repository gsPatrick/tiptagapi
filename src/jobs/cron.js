const cron = require('node-cron');
const { CreditoLoja, Peca, Sacolinha, FilaBot, Configuracao, Pessoa } = require('../../models');
const { Op } = require('sequelize');
const { subDays } = require('date-fns');
const automacaoService = require('../features/automacao/automacao.service');

class CronService {
    init() {
        // Run every hour
        cron.schedule('0 * * * *', async () => {
            console.log('Running Hourly Cron Jobs...');
            await this.checkSmartCashbackReset();
        });

        // Run every day at 00:00
        cron.schedule('0 0 * * *', async () => {
            console.log('Running Daily Cron Jobs...');
            await this.checkPecasParadas();
            await this.checkSacolinhasVencidas();
        });
    }

    async checkSmartCashbackReset() {
        const now = new Date();

        const configDia = await Configuracao.findByPk('CASHBACK_DIA_RESET');
        const configHora = await Configuracao.findByPk('CASHBACK_HORA_RESET');

        if (!configDia || !configHora) return;

        const diaReset = parseInt(configDia.valor);
        const [horaReset, minReset] = configHora.valor.split(':').map(Number);

        if (now.getDate() === diaReset) {
            if (now.getHours() === horaReset) {
                // Expire Credits
                await CreditoLoja.update(
                    { status: 'EXPIRADO' },
                    {
                        where: {
                            status: 'ATIVO',
                            data_validade: { [Op.lte]: now }
                        }
                    }
                );
                console.log('Cashback Reset Executed');

                // --- NOTIFY ADMIN VIA EMAIL (Dynamic) ---
                const adminEmail = process.env.EMAIL_ADMIN || 'admin@tiptag.com';
                await automacaoService.agendarMensagem({
                    email: adminEmail,
                    canal: 'EMAIL',
                    gatilho: 'RESET_CASHBACK',
                    variaveis: {
                        DATA_HORA: now.toLocaleString()
                    },
                    // Fallback
                    assunto: 'Aviso de Reset de Cashback',
                    mensagem: `<p>O reset de cashback foi executado em ${now.toLocaleString()}.</p>`
                });
                // -----------------------------
            }
        }
    }

    async checkPecasParadas() {
        const cutoff = subDays(new Date(), 180);
        const pecas = await Peca.findAll({
            where: {
                data_entrada: { [Op.lte]: cutoff },
                status: 'DISPONIVEL'
            }
        });
        // Log or notify
    }

    async checkSacolinhasVencidas() {
        const today = new Date();
        await Sacolinha.update(
            { status: 'CANCELADA' },
            { where: { data_vencimento: { [Op.lt]: today }, status: 'ABERTA' } }
        );
    }
}

module.exports = new CronService();
