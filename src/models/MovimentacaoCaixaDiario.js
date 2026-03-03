const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class MovimentacaoCaixaDiario extends Model {
        static associate(models) {
            MovimentacaoCaixaDiario.belongsTo(models.CaixaDiario, { foreignKey: 'caixaDiarioId', as: 'caixa' });
            MovimentacaoCaixaDiario.belongsTo(models.User, { foreignKey: 'userId', as: 'autorizador' });
        }
    }
    MovimentacaoCaixaDiario.init({
        caixaDiarioId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'caixas_diarios', key: 'id' },
        },
        tipo: {
            type: DataTypes.ENUM('SANGRIA', 'SUPRIMENTO'),
            allowNull: false,
        },
        valor: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        descricao: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'users', key: 'id' },
        },
    }, {
        sequelize,
        modelName: 'MovimentacaoCaixaDiario',
        tableName: 'movimentacoes_caixa_diario',
        paranoid: true,
        timestamps: true,
    });
    return MovimentacaoCaixaDiario;
};
