const cron = require('node-cron');
const { CreditoLoja, Peca, Sacolinha, FilaBot, Configuracao, Pessoa, Notificacao, ContaCorrentePessoa, sequelize } = require('../models');
const { Op } = require('sequelize');
const { subDays, startOfMonth, format, endOfMonth, subMilliseconds } = require('date-fns');
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
            await this.autoFecharCaixas();
            await this.checkPecasParadas();
            await this.checkSacolinhasVencidas();
            await this.checkCreditosVencidos();
        });

        // Run monthly on the 1st at 08:00 AM
        cron.schedule('0 8 1 * *', async () => {
            console.log('Running Monthly Cycle Jobs...');
            await this.runMonthlyCycle();
        });

        // Run reminder on the last day of the month at 09:00 AM
        cron.schedule('0 9 28-31 * *', async () => {
            if (format(new Date(), 'dd') !== format(endOfMonth(new Date()), 'dd')) return;
            console.log('Running Expiration Reminder Jobs (Last day of month)...');
            await this.runExpirationReminder();
        });

        // Run mid-month supplier credit reminder on the 15th at 09:00 AM
        cron.schedule('0 9 15 * *', async () => {
            console.log('Running Mid-Month Supplier Credit Reminder...');
            await this.runMidMonthSupplierReminder();
        });
    }

    async autoFecharCaixas() {
        try {
            const caixaService = require('../features/caixa/caixa.service');
            console.log('[CRON] Verificando caixas abertos para fechamento automático...');
            const results = await caixaService.fecharTodosCaixasAbertos();
            console.log(`[CRON] Auto-fechamento concluído: ${results.length} caixas processados.`);
        } catch (err) {
            console.error('[CRON] Erro ao fechar caixas automaticamente:', err.message);
        }
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

            // 1. Expire old 'ATIVO' credits (from previous months)
            // Anything with validity <= today (which means it ended yesterday at 23:59)
            const [expiredCount] = await CreditoLoja.update(
                { status: 'EXPIRADO' },
                {
                    where: {
                        status: 'ATIVO',
                        data_validade: { [Op.lte]: now }
                    },
                    transaction: t
                }
            );
            console.log(`[MonthlyCycle] Force-expired ${expiredCount} active credits during transition.`);

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

            // 3. Reset supplier commission balances (ContaCorrentePessoa)
            // Sales Month M-2 should expire on Month M.
            // Example: January sales (available in Feb) expire on March 1st.
            
            const { subMonths, endOfMonth } = require('date-fns');
            const resetLimitDate = endOfMonth(subMonths(now, 2));

            const balances = await ContaCorrentePessoa.findAll({
                attributes: [
                    'pessoaId',
                    [sequelize.fn('SUM', sequelize.literal("CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END")), 'saldo']
                ],
                where: {
                    data_movimento: { [Op.lte]: resetLimitDate }
                },
                group: ['pessoaId'],
                having: sequelize.literal("SUM(CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END) > 0"),
                transaction: t
            });

            console.log(`[MonthlyCycle] Found ${balances.length} supplier balances (from before ${resetLimitDate.toISOString()}) to reset.`);

            console.log(`[MonthlyCycle] Found ${balances.length} supplier balances to reset.`);

            for (const b of balances) {
                await ContaCorrentePessoa.create({
                    pessoaId: b.pessoaId,
                    tipo: 'DEBITO',
                    valor: b.get('saldo'),
                    descricao: 'Reset mensal de saldo de comissões',
                    data_movimento: now
                }, { transaction: t });
            }

            let messagesQueued = 0;

            // Notify suppliers with newly available credits
            const suppliersWithCredits = await ContaCorrentePessoa.findAll({
                attributes: [
                    'pessoaId',
                    [sequelize.fn('SUM', sequelize.literal("CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END")), 'saldo']
                ],
                where: {
                    data_movimento: { [Op.lt]: startOfMonth(now) }
                },
                group: ['pessoaId'],
                having: sequelize.literal("SUM(CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END) > 0"),
                transaction: t
            });

            for (const s of suppliersWithCredits) {
                const saldo = parseFloat(s.get('saldo'));
                const pessoa = await Pessoa.findByPk(s.pessoaId, { transaction: t });
                if (pessoa && pessoa.telefone_whatsapp && pessoa.is_fornecedor) {
                    await automacaoService.agendarMensagem({
                        telefone: pessoa.telefone_whatsapp,
                        canal: 'WHATSAPP',
                        gatilho: 'CREDITO_LIBERADO',
                        variaveis: {
                            NOME: pessoa.nome,
                            VALOR: saldo.toFixed(2)
                        },
                        mensagem: `Olá ${pessoa.nome}! 🎉 Seus créditos de R$ ${saldo.toFixed(2)} foram liberados e já estão disponíveis para uso na loja Garimpô Nós. Venha aproveitar!`
                    });
                    messagesQueued++;
                }
            }

            console.log(`[MonthlyCycle] Queued ${messagesQueued} notifications for suppliers.`);

            await t.commit();
        } catch (err) {
            if (t) await t.rollback();
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
                    mensagem: `Olá ${data.cliente.nome}, você ainda tem R$ ${data.total.toFixed(2)} em créditos que vencem HOJE! Venha usar na loja antes que expirem.`
                });
            }
        }

        // Also notify suppliers with ContaCorrentePessoa credits
        const supplierBalances = await ContaCorrentePessoa.findAll({
            attributes: [
                'pessoaId',
                [sequelize.fn('SUM', sequelize.literal("CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END")), 'saldo']
            ],
            where: {
                data_movimento: { [Op.lt]: startOfMonth(new Date()) }
            },
            group: ['pessoaId'],
            having: sequelize.literal("SUM(CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END) > 0")
        });

        for (const b of supplierBalances) {
            const saldo = parseFloat(b.get('saldo'));
            const pessoa = await Pessoa.findByPk(b.pessoaId);
            if (pessoa && pessoa.telefone_whatsapp && pessoa.is_fornecedor) {
                await automacaoService.agendarMensagem({
                    telefone: pessoa.telefone_whatsapp,
                    canal: 'WHATSAPP',
                    gatilho: 'LEMBRETE_EXPIRACAO',
                    variaveis: {
                        NOME: pessoa.nome,
                        VALOR: saldo.toFixed(2)
                    },
                    mensagem: `Olá ${pessoa.nome}, seus créditos de R$ ${saldo.toFixed(2)} vencem HOJE! Aproveite para usar na loja Garimpô Nós antes que expirem.`
                });
            }
        }
    }

    async runMidMonthSupplierReminder() {
        try {
            // Find all suppliers with positive ContaCorrentePessoa balance
            const supplierBalances = await ContaCorrentePessoa.findAll({
                attributes: [
                    'pessoaId',
                    [sequelize.fn('SUM', sequelize.literal("CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END")), 'saldo']
                ],
                where: {
                    data_movimento: { [Op.lt]: startOfMonth(new Date()) }
                },
                group: ['pessoaId'],
                having: sequelize.literal("SUM(CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END) > 0")
            });

            let sent = 0;
            for (const b of supplierBalances) {
                const saldo = parseFloat(b.get('saldo'));
                const pessoa = await Pessoa.findByPk(b.pessoaId);
                if (pessoa && pessoa.telefone_whatsapp && pessoa.is_fornecedor) {
                    await automacaoService.agendarMensagem({
                        telefone: pessoa.telefone_whatsapp,
                        canal: 'WHATSAPP',
                        gatilho: 'LEMBRETE_CREDITO_MEIO_MES',
                        variaveis: {
                            NOME: pessoa.nome,
                            VALOR: saldo.toFixed(2)
                        },
                        mensagem: `Olá ${pessoa.nome}! Lembrete: você possui R$ ${saldo.toFixed(2)} em créditos disponíveis na Garimpô Nós. Aproveite para usar suas peças!`
                    });
                    sent++;
                }
            }

            // Also check CreditoLoja for clients
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
                        gatilho: 'LEMBRETE_CREDITO_MEIO_MES',
                        variaveis: {
                            NOME: data.cliente.nome,
                            VALOR: data.total.toFixed(2)
                        },
                        mensagem: `Olá ${data.cliente.nome}! Lembrete: você possui R$ ${data.total.toFixed(2)} em créditos disponíveis na Garimpô Nós. Use antes do vencimento!`
                    });
                    sent++;
                }
            }

            console.log(`[MidMonthReminder] Sent ${sent} reminder messages.`);
        } catch (err) {
            console.error('[MidMonthReminder] Error:', err);
        }
    }

}

module.exports = new CronService();
