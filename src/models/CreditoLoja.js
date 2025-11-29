const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class CreditoLoja extends Model {
        static associate(models) {
            CreditoLoja.belongsTo(models.Pessoa, { foreignKey: 'clienteId', as: 'cliente' });
        }
    }
    CreditoLoja.init({
        clienteId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'pessoas', key: 'id' },
        },
        valor: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        data_validade: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('ATIVO', 'USADO', 'EXPIRADO'),
            defaultValue: 'ATIVO',
        },
        codigo_cupom: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'CreditoLoja',
        tableName: 'creditos_loja',
        paranoid: true,
        timestamps: true,
    });
    return CreditoLoja;
};
