const { Pedido, Peca, ContaPagarReceber, Repasse, sequelize } = require('../../models');
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
        CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END
      ) as total_pendente
      FROM conta_corrente_pessoas ccp
      JOIN pessoas p ON ccp."pessoaId" = p.id
      WHERE p.is_fornecedor = true
    `);
        // The query above sums everything. We need to filter by person first to see if balance > 0.
        // A better approximation for dashboard speed:
        // Sum of all credits - Sum of all debits for suppliers.
        // This is global.
        const totalCreditos = await sequelize.query(`
      SELECT SUM(valor) as total FROM conta_corrente_pessoas ccp
      JOIN pessoas p ON ccp."pessoaId" = p.id
      WHERE p.is_fornecedor = true AND ccp.tipo = 'CREDITO'
    `, { type: sequelize.QueryTypes.SELECT });

        const totalDebitos = await sequelize.query(`
      SELECT SUM(valor) as total FROM conta_corrente_pessoas ccp
      JOIN pessoas p ON ccp."pessoaId" = p.id
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

        return {
            cards: {
                vendas_hoje: vendasHoje || 0,
                pecas_cadastradas_mes: pecasMes || 0,
                contas_pagar_pendente: contasPagar || 0,
                repasses_pendentes: repassesPendentes > 0 ? repassesPendentes : 0
            },
            grafico_vendas_7d: vendasChart,
            alertas: {
                pecas_paradas_180d: pecasParadas
            }
        };
    }
}

module.exports = new DashboardService();
