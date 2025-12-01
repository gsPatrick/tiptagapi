const { Pedido, Peca, ContaPagarReceber, Repasse, sequelize, ContaCorrentePessoa, Pessoa, Notificacao } = require('../../models');
const { Op } = require('sequelize');
const { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, format } = require('date-fns');

class DashboardService {
    async getResumo() {
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const monthStart = startOfMonth(new Date());
        const monthEnd = endOfMonth(new Date());

        // 1. Vendas Hoje (R$)
        const vendasHoje = await Pedido.sum('total', {
            where: {
                data_pedido: { [Op.between]: [todayStart, todayEnd] },
                status: 'PAGO'
            }
        });

        // 2. Peças Cadastradas Mês (Qtd)
        const pecasMes = await Peca.count({
            where: {
                data_entrada: { [Op.between]: [monthStart, monthEnd] }
            }
        });

        // 3. Contas a Pagar (R$ Pendente)
        const contasPagar = await ContaPagarReceber.sum('valor_previsto', {
            where: {
                tipo: 'PAGAR',
                status: 'PENDENTE'
            }
        });

        // 4. Repasses Pendentes (R$)
        // Assuming Repasse model tracks batches, or we sum from ContaCorrentePessoa (positive balances)
        // Let's use the Repasse model if it tracks pending batches, or sum positive balances of suppliers.
        // Prompt says "Repasses Pendentes (R$)".
        // If we use the logic from FinanceiroService (sum of positive balances), that's accurate.
        // Let's replicate that logic or use Repasse table if we create records beforehand.
        // Given the flow, Repasse records are created upon payment. So "Pending" implies positive balance not yet paid.
        // We'll calculate sum of positive balances for suppliers.
        const [result] = await sequelize.query(`
      SELECT SUM(
        CASE WHEN ccp.tipo = 'CREDITO' THEN valor ELSE -valor END
      ) as total_pendente
      FROM conta_corrente_pessoas ccp
      JOIN pessoas p ON ccp.pessoa_id = p.id
      WHERE p.is_fornecedor = true
    `);
        // The query above sums everything. We need to filter by person first to see if balance > 0.
        // A better approximation for dashboard speed:
        // Sum of all credits - Sum of all debits for suppliers.
        // This is global.
        const totalCreditos = await sequelize.query(`
      SELECT SUM(valor) as total FROM conta_corrente_pessoas ccp
      JOIN pessoas p ON ccp.pessoa_id = p.id
      WHERE p.is_fornecedor = true AND ccp.tipo = 'CREDITO'
    `, { type: sequelize.QueryTypes.SELECT });

        const totalDebitos = await sequelize.query(`
      SELECT SUM(valor) as total FROM conta_corrente_pessoas ccp
      JOIN pessoas p ON ccp.pessoa_id = p.id
      WHERE p.is_fornecedor = true AND ccp.tipo = 'DEBITO'
    `, { type: sequelize.QueryTypes.SELECT });

        const repassesPendentes = (parseFloat(totalCreditos[0].total || 0) - parseFloat(totalDebitos[0].total || 0));


        // 5. Gráfico: Vendas últimos 7 dias
        const sevenDaysAgo = subDays(new Date(), 7);
        const vendasChart = await Pedido.findAll({
            attributes: [
                [sequelize.fn('DATE', sequelize.col('data_pedido')), 'data'],
                [sequelize.fn('SUM', sequelize.col('total')), 'total']
            ],
            where: {
                data_pedido: { [Op.gte]: sevenDaysAgo },
                status: 'PAGO'
            },
            group: [sequelize.fn('DATE', sequelize.col('data_pedido'))],
            order: [[sequelize.fn('DATE', sequelize.col('data_pedido')), 'ASC']]
        });

        // 6. Alerta: Peças paradas > 180 dias
        const cutoff180 = subDays(new Date(), 180);
        const pecasParadas = await Peca.count({
            where: {
                data_entrada: { [Op.lte]: cutoff180 },
                status: 'DISPONIVEL'
            }
        });

        // --- NEW METRICS FOR FRONTEND ---
        const yesterdayStart = startOfDay(subDays(new Date(), 1));
        const yesterdayEnd = endOfDay(subDays(new Date(), 1));
        const thirtyDaysAgo = subDays(new Date(), 30);
        const twelveMonthsAgo = subDays(new Date(), 365);

        // KPIs
        const novas = await Peca.count({ where: { status: 'NOVA' } });
        const novas30d = await Peca.count({ where: { status: 'NOVA', data_entrada: { [Op.gte]: thirtyDaysAgo } } });
        const novasOntem = await Peca.count({ where: { status: 'NOVA', data_entrada: { [Op.between]: [yesterdayStart, yesterdayEnd] } } });

        const emAutorizacao = await Peca.count({ where: { status: 'EM_AUTORIZACAO' } });
        const autorizadasOntem = await Peca.count({ where: { status: 'DISPONIVEL', data_entrada: { [Op.between]: [yesterdayStart, yesterdayEnd] } } }); // Approx

        const aVenda = await Peca.count({ where: { status: 'DISPONIVEL' } });
        const aVendaOntem = await Peca.count({ where: { status: 'DISPONIVEL', data_entrada: { [Op.between]: [yesterdayStart, yesterdayEnd] } } });

        const vendidas30d = await Peca.count({ where: { status: 'VENDIDA', data_venda: { [Op.gte]: thirtyDaysAgo } } });

        // Resumo Geral
        const estoqueTotal = await Peca.count();
        const valorEstoque = await Peca.sum('preco_venda', { where: { status: { [Op.in]: ['NOVA', 'DISPONIVEL', 'EM_AUTORIZACAO'] } } });

        const vendas12mOrders = await Pedido.findAll({
            where: { status: 'PAGO', data_pedido: { [Op.gte]: twelveMonthsAgo } },
            include: [{ model: PagamentoPedido, as: 'pagamentos', attributes: ['metodo', 'valor'] }],
            attributes: ['total']
        });

        let vendas12mReal = 0;
        let vendas12mPermuta = 0;

        vendas12mOrders.forEach(p => {
            if (p.pagamentos && p.pagamentos.length > 0) {
                p.pagamentos.forEach(pay => {
                    if (pay.metodo === 'VOUCHER_PERMUTA') {
                        vendas12mPermuta += parseFloat(pay.valor || 0);
                    } else {
                        vendas12mReal += parseFloat(pay.valor || 0);
                    }
                });
            } else {
                vendas12mReal += parseFloat(p.total || 0);
            }
        });
        const vendas12m = vendas12mReal + vendas12mPermuta;
        const saidas12m = await ContaPagarReceber.sum('valor_pago', { where: { tipo: 'PAGAR', status: 'PAGO', data_pagamento: { [Op.gte]: twelveMonthsAgo } } });
        // Repasses 12m (approx)
        const [repassesResult] = await sequelize.query(`
            SELECT SUM(ccp.valor) as total
            FROM conta_corrente_pessoas ccp
            JOIN pessoas p ON ccp.pessoa_id = p.id
            WHERE ccp.tipo = 'DEBITO'
            AND ccp.data_movimento >= :date
            AND p.is_fornecedor = true
        `, {
            replacements: { date: twelveMonthsAgo },
            type: sequelize.QueryTypes.SELECT
        });
        const repasses12m = repassesResult ? parseFloat(repassesResult.total || 0) : 0;

        const fornecedoresCount = await Pessoa.count({ where: { is_fornecedor: true } });
        const clientesCount = await Pessoa.count({ where: { is_cliente: true } });

        // Vendas Mes (Area Chart)
        // Group by month for the last 6-12 months
        const vendasMesChart = await Pedido.findAll({
            attributes: [
                [sequelize.fn('TO_CHAR', sequelize.col('data_pedido'), 'Mon'), 'name'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'vendas']
            ],
            where: {
                status: 'PAGO',
                data_pedido: { [Op.gte]: twelveMonthsAgo }
            },
            group: [sequelize.fn('TO_CHAR', sequelize.col('data_pedido'), 'Mon'), sequelize.fn('DATE_TRUNC', 'month', sequelize.col('data_pedido'))],
            order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('data_pedido')), 'ASC']]
        });

        // Notifications
        const notificacoes = await Notificacao.findAll({
            limit: 5,
            order: [['createdAt', 'DESC']]
        });

        return {
            kpis: {
                novas,
                novas30d,
                novasOntem,
                emAutorizacao,
                autorizadasOntem,
                aVenda,
                aVendaOntem,
                vendidas30d
            },
            vendas7Dias: vendasChart.map(v => ({ name: format(new Date(v.getDataValue('data')), 'dd/MM'), vendas: parseFloat(v.getDataValue('total')) })),
            vendasMes: vendasMesChart,
            resumo: {
                estoqueTotal,
                valorEstoque: parseFloat(valorEstoque || 0),
                vendas12m: parseFloat(vendas12m || 0),
                vendas12mReal: parseFloat(vendas12mReal || 0),
                vendas12mPermuta: parseFloat(vendas12mPermuta || 0),
                saidas12m: parseFloat(saidas12m || 0),
                repasses12m: parseFloat(repasses12m || 0),
                fornecedores: fornecedoresCount,
                clientes: clientesCount
            },
            notificacoes,
            // Keep old structure just in case
            cards: {
                vendas_hoje: vendasHoje || 0,
                pecas_cadastradas_mes: pecasMes || 0,
                contas_pagar_pendente: contasPagar || 0,
                repasses_pendentes: repassesPendentes > 0 ? repassesPendentes : 0
            },
            alertas: {
                pecas_paradas_180d: pecasParadas
            }
        };
    }
}

module.exports = new DashboardService();
