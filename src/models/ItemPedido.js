const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ItemPedido extends Model {
        static associate(models) {
            ItemPedido.belongsTo(models.Pedido, { foreignKey: 'pedidoId', as: 'pedido' });
            ItemPedido.belongsTo(models.Peca, { foreignKey: 'pecaId', as: 'peca' });
        }
    }
    ItemPedido.init({
        pedidoId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'pedidos', key: 'id' },
        },
        pecaId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'pecas', key: 'id' },
        },
        valor_unitario_final: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'ItemPedido',
        tableName: 'itens_pedido',
        paranoid: true,
        timestamps: true,
    });
    return ItemPedido;
};
