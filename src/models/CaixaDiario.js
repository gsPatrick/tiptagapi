const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class CaixaDiario extends Model {
        static associate(models) {
            CaixaDiario.belongsTo(models.User, { foreignKey: 'userId', as: 'operador' });
            CaixaDiario.hasMany(models.MovimentacaoCaixaDiario, { foreignKey: 'caixaDiarioId', as: 'movimentacoes' });
        }
    }
    CaixaDiario.init({
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'users', key: 'id' },
        },
        data_abertura: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        data_fechamento: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        saldo_inicial: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        saldo_final_informado: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        saldo_final_calculado: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        diferenca_quebra: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        total_entradas_dinheiro: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        total_saidas_sangria: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        status: {
            type: DataTypes.ENUM('ABERTO', 'FECHADO'),
            defaultValue: 'ABERTO',
        },
    }, {
        sequelize,
        modelName: 'CaixaDiario',
        tableName: 'caixas_diarios',
        paranoid: true,
        timestamps: true,
    });
    return CaixaDiario;
};
