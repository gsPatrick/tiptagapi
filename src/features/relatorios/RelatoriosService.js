const { Pedido, ItemPedido, Peca, Categoria, Marca, User, Sequelize } = require('../../models');
const { Op } = require('sequelize');

class RelatoriosService {
    async getResumo() {
        const totalVendas = await Pedido.sum('total', {
            where: { status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] } }
        });

        const totalPedidos = await Pedido.count({
            where: { status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] } }
        });

        const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;

        return {
            totalVendas: parseFloat(totalVendas || 0).toFixed(2),
            totalPedidos,
            ticketMedio: parseFloat(ticketMedio).toFixed(2)
        };
    }

    async getVendasPorCategoria() {
        const vendas = await ItemPedido.findAll({
            attributes: [
                [Sequelize.col('peca.categoria.nome'), 'categoria'],
                [Sequelize.fn('SUM', Sequelize.col('valor_unitario_final')), 'total']
            ],
            include: [
                {
                    model: Peca,
                    as: 'peca',
                    attributes: [],
                    include: [{ model: Categoria, as: 'categoria', attributes: [] }]
                },
                {
                    model: Pedido,
                    as: 'pedido',
                    attributes: [],
                    where: { status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] } }
                }
            ],
            group: [Sequelize.col('peca.categoria.nome')],
            raw: true,
            order: [[Sequelize.literal('total'), 'DESC']]
        });

        return vendas;
    }

    async getVendasPorMarca() {
        const vendas = await ItemPedido.findAll({
            attributes: [
                [Sequelize.col('peca.marca.nome'), 'marca'],
                [Sequelize.fn('SUM', Sequelize.col('valor_unitario_final')), 'total']
            ],
            include: [
                {
                    model: Peca,
                    as: 'peca',
                    attributes: [],
                    include: [{ model: Marca, as: 'marca', attributes: [] }]
                },
                {
                    model: Pedido,
                    as: 'pedido',
                    attributes: [],
                    where: { status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] } }
                }
            ],
            group: [Sequelize.col('peca.marca.nome')],
            raw: true,
            order: [[Sequelize.literal('total'), 'DESC']]
        });

        return vendas;
    }

    async getPerformanceVendedor() {
        const performance = await Pedido.findAll({
            attributes: [
                [Sequelize.col('vendedor.nome'), 'vendedor'],
                [Sequelize.fn('SUM', Sequelize.col('total')), 'total_vendas'],
                [Sequelize.fn('COUNT', Sequelize.col('Pedido.id')), 'quantidade_pedidos']
            ],
            include: [{ model: User, as: 'vendedor', attributes: [] }],
            where: {
                status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] },
                vendedorId: { [Op.ne]: null }
            },
            group: [Sequelize.col('vendedor.nome')],
            raw: true,
            order: [[Sequelize.literal('total_vendas'), 'DESC']]
        });

        return performance.map(p => {
            const total = parseFloat(p.total_vendas);
            const qtd = parseInt(p.quantidade_pedidos);
            const score = (total / 100) + (qtd * 10);
            return {
                ...p,
                score: Math.round(score)
            };
        });
    }
}

module.exports = new RelatoriosService();
