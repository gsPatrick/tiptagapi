const cron = require('node-cron');
const { CreditoLoja, Peca, Sacolinha, FilaBot, Configuracao, Pessoa, Notificacao } = require('../models');
const { Op } = require('sequelize');
const { subDays, startOfMonth, format } = require('date-fns');
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
            await this.checkCreditosVencidos();
        });

        // Run monthly on the 1st at 08:00 AM
        cron.schedule('0 8 1 * *', async () => {
            console.log('Running Monthly Cycle Jobs...');
            await this.runMonthlyCycle();
        });

        // Run reminder on the 25th at 09:00 AM
        cron.schedule('0 9 25 * *', async () => {
            console.log('Running Expiration Reminder Jobs...');
            await this.runExpirationReminder();
        });
    }

    async checkCreditosVencidos() {
        const today = new Date();
        const [affectedCount] = await CreditoLoja.update(
            { status: 'EXPIRADO' },
            {
                where: {
                    status: 'ATIVO',
                    data_validade: { [Op.lt]: today }
                }
            }
        );
        console.log(`Rotina de expiração: ${affectedCount} créditos expirados.`);
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
        if (pecas.length > 0) {
            await Notificacao.create({
                mensagem: `Hoje ${pecas.length} peças foram identificadas com mais de 180 dias em estoque.`,
                tipo: 'ALERTA'
            });
            console.log(`Notificacao criada: ${pecas.length} pecas paradas.`);
        }
    }

    async checkSacolinhasVencidas() {
        const today = new Date();
        await Sacolinha.update(
            { status: 'CANCELADA' },
            { where: { data_vencimento: { [Op.lt]: today }, status: 'ABERTA' } }
        );
    }

    async runMonthlyCycle() {
        const t = await require('../models').sequelize.transaction();
        try {
            const now = new Date();

            // 1. Expire old 'ATIVO' credits (from previous month)
            // Actually, if we set validity correctly, checkCreditosVencidos handles it?
            // But the rule says: "No dia 01... créditos do mês anterior que ainda eram ATIVO viram EXPIRADO."
            // If we set validity to end of month, checkCreditosVencidos (daily) will catch them on day 1 (since valid < today).
            // But let's be explicit here to ensure the "Virada" happens atomically.

            // 1. Expire ALL 'ATIVO' credits from previous month (Reset Balance)
            const [expiredCount] = await CreditoLoja.update(
                { status: 'EXPIRADO' },
                {
                    where: {
                        status: 'ATIVO',
                        // No date check needed if we want to reset ALL active credits on the 1st
                        // But to be safe, we can check if created before today?
                        // The rule is: "todo o credito que a pessoa tinha no mes vai ser resetado"
                        // So we expire everything that is currently ATIVO.
                    },
                    transaction: t
                }
            );
            console.log(`[MonthlyCycle] Expired ${expiredCount} old credits (Monthly Reset).`);

            // 2. Activate 'AGUARDANDO_LIBERACAO' credits
            // And set validity to end of THIS month.
            const endOfCurrentMonth = endOfMonth(now);

            const [activatedCount] = await CreditoLoja.update(
                {
                    status: 'ATIVO',
                    data_validade: endOfCurrentMonth
                },
                {
                    where: { status: 'AGUARDANDO_LIBERACAO' },
                    transaction: t
                }
            );
            console.log(`[MonthlyCycle] Activated ${activatedCount} new credits.`);

            await t.commit();

            // 3. Notify Clients (Bot)
            // We need to group by client to send one message per client.
            // We can fetch the credits that were just activated? 
            // Or just fetch all currently ATIVO credits created recently?
            // Let's fetch all clients who have ATIVO credits that started today?
            // Or simpler: Fetch all 'ATIVO' credits, group by client, sum value.
            // But we only want to notify about the NEW ones.
            // The ones we just updated were 'AGUARDANDO_LIBERACAO'.
            // We can't easily get the IDs from update().

            // Alternative: Fetch 'AGUARDANDO_LIBERACAO' BEFORE update.
            // But we already committed.

            // Let's fetch all ATIVO credits created in the last month (which were waiting).
            // Or simply fetch all ATIVO credits for simplicity of the message "You have credits".
            // The prompt says: "suas vendas de {MES_ANTERIOR} geraram R$ {VALOR}..."

            // Let's find credits that are ATIVO and created last month.
            const lastMonthStart = startOfMonth(subDays(now, 15)); // Go back to prev month
            const credits = await CreditoLoja.findAll({
                where: {
                    status: 'ATIVO',
                    createdAt: { [Op.gte]: lastMonthStart } // Rough filter
                },
                include: [{ model: Pessoa, as: 'cliente' }]
            });

            const clientCredits = {};
            for (const c of credits) {
                if (!clientCredits[c.clienteId]) {
                    clientCredits[c.clienteId] = {
                        cliente: c.cliente,
                        total: 0,
                        validade: c.data_validade
                    };
                }
                clientCredits[c.clienteId].total += parseFloat(c.valor);
            }

            const mesAnterior = format(subDays(now, 15), 'MMMM', { locale: require('date-fns/locale/pt-BR') });

            for (const clientId in clientCredits) {
                const data = clientCredits[clientId];
                if (data.cliente && data.cliente.telefone_whatsapp) {
                    await automacaoService.agendarMensagem({
                        telefone: data.cliente.telefone_whatsapp,
                        canal: 'WHATSAPP',
                        gatilho: 'VIRADA_MENSAL',
                        variaveis: {
                            NOME: data.cliente.nome,
                            MES_ANTERIOR: mesAnterior,
                            VALOR: data.total.toFixed(2),
                            DATA_VALIDADE: new Date(data.validade).toLocaleDateString('pt-BR')
                        },
                        mensagem: `Olá ${data.cliente.nome}, suas vendas de ${mesAnterior} geraram R$ ${data.total.toFixed(2)} em créditos! Válido até ${new Date(data.validade).toLocaleDateString('pt-BR')}.`
                    });
                }
            }

        } catch (err) {
            await t.rollback();
            console.error('[MonthlyCycle] Error:', err);
        }
    }

    async runExpirationReminder() {
        // Find clients with active balance > 0
        // We need to sum active credits per client.
        const credits = await CreditoLoja.findAll({
            where: { status: 'ATIVO', valor: { [Op.gt]: 0 } },
            include: [{ model: Pessoa, as: 'cliente' }]
        });

        const clientTotals = {};
        for (const c of credits) {
            if (!clientTotals[c.clienteId]) {
                clientTotals[c.clienteId] = { cliente: c.cliente, total: 0 };
            }
            clientTotals[c.clienteId].total += parseFloat(c.valor);
        }

        for (const clientId in clientTotals) {
            const data = clientTotals[clientId];
            if (data.cliente && data.cliente.telefone_whatsapp) {
                await automacaoService.agendarMensagem({
                    telefone: data.cliente.telefone_whatsapp,
                    canal: 'WHATSAPP',
                    gatilho: 'LEMBRETE_EXPIRACAO',
                    variaveis: {
                        NOME: data.cliente.nome,
                        VALOR: data.total.toFixed(2)
                    },
                    mensagem: `Olá ${data.cliente.nome}, você ainda tem R$ ${data.total.toFixed(2)} em créditos que vencem em 5 dias!`
                });
            }
        }
    }

}

module.exports = new CronService();
