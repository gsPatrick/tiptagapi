const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PagamentoPedido extends Model {
        static associate(models) {
            PagamentoPedido.belongsTo(models.Pedido, { foreignKey: 'pedidoId', as: 'pedido' });
        }
    }
    PagamentoPedido.init({
        pedidoId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'pedidos', key: 'id' },
        },
        metodo: {
            type: DataTypes.ENUM('PIX', 'CREDITO', 'DEBITO', 'DINHEIRO', 'CREDITO_LOJA'),
            allowNull: false,
        },
        valor: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        parcelas: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
        },
        taxa_processamento: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
    }, {
        sequelize,
        modelName: 'PagamentoPedido',
        tableName: 'pagamentos_pedido',
        paranoid: true,
        timestamps: true,
    });
    return PagamentoPedido;
};
