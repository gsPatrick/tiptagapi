const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class OrigemVenda extends Model {
        static associate(models) {
            // Associations
        }
    }
    OrigemVenda.init({
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'OrigemVenda',
        tableName: 'origens_venda',
        paranoid: true,
        timestamps: true,
    });
    return OrigemVenda;
};
