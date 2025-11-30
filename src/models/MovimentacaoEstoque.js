const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class MovimentacaoEstoque extends Model {
        static associate(models) {
            MovimentacaoEstoque.belongsTo(models.Peca, { foreignKey: 'pecaId', as: 'peca' });
            MovimentacaoEstoque.belongsTo(models.User, { foreignKey: 'userId', as: 'usuario' });
        }
    }
    MovimentacaoEstoque.init({
        pecaId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'pecas', key: 'id' },
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true, // System might trigger it
            references: { model: 'users', key: 'id' },
        },
        tipo: {
            type: DataTypes.ENUM('ENTRADA', 'SAIDA_VENDA', 'DEVOLUCAO', 'AJUSTE_INVENTARIO', 'EXTRAVIO', 'ENTRADA_DEVOLUCAO'),
            allowNull: false,
        },
        quantidade: {
            type: DataTypes.INTEGER,
            defaultValue: 1, // Usually 1 or -1 for unique items
        },
        motivo: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        data_movimento: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        sequelize,
        modelName: 'MovimentacaoEstoque',
        tableName: 'movimentacoes_estoque',
        paranoid: true,
        timestamps: true,
    });
    return MovimentacaoEstoque;
};
