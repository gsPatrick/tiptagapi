const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DimensaoPadrao extends Model {
        static associate(models) {
            // Associations
        }
    }
    DimensaoPadrao.init({
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        peso_kg: {
            type: DataTypes.DECIMAL(10, 3), // 3 decimal places for kg
            allowNull: false,
        },
        altura_cm: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        largura_cm: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        comprimento_cm: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        ativo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'DimensaoPadrao',
        tableName: 'dimensoes_padrao',
        paranoid: true,
        timestamps: true,
    });
    return DimensaoPadrao;
};
