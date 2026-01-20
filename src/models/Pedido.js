const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Pedido extends Model {
        static associate(models) {
            Pedido.belongsTo(models.Pessoa, { foreignKey: 'clienteId', as: 'cliente' });
            Pedido.belongsTo(models.User, { foreignKey: 'vendedorId', as: 'vendedor' });
            Pedido.hasMany(models.ItemPedido, { foreignKey: 'pedidoId', as: 'itens' });
            Pedido.hasMany(models.PagamentoPedido, { foreignKey: 'pedidoId', as: 'pagamentos' });
        }
    }
    Pedido.init({
        codigo_pedido: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
        },
        origem: {
            type: DataTypes.ENUM('PDV', 'ECOMMERCE', 'INSTAGRAM'),
            allowNull: false,
        },
        clienteId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'pessoas', key: 'id' },
        },
        vendedorId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'users', key: 'id' },
        },
        status: {
            type: DataTypes.ENUM('RASCUNHO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE', 'CANCELADO', 'DEVOLVIDO'),
            defaultValue: 'RASCUNHO',
        },
        tipo_frete: {
            type: DataTypes.ENUM('CORREIOS', 'MOTOBOY', 'RETIRADA'),
            allowNull: true,
        },
        valor_frete: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        codigo_rastreio: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        subtotal: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        desconto: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        total: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        nota_fiscal_url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        observacoes_internas: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        data_pedido: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        sequelize,
        modelName: 'Pedido',
        tableName: 'pedidos',
        paranoid: true,
        timestamps: true,
    });
    return Pedido;
};
