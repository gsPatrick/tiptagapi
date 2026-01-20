const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ContaBancariaLoja extends Model {
        static associate(models) {
            // Associations
        }
    }
    ContaBancariaLoja.init({
        nome_referencia: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        banco: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        agencia: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        conta: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        pix: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'ContaBancariaLoja',
        tableName: 'contas_bancarias_loja',
        paranoid: true,
        timestamps: true,
    });
    return ContaBancariaLoja;
};
