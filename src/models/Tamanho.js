const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Tamanho extends Model {
        static associate(models) {
            // Associations will be defined here
        }
    }
    Tamanho.init({
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        ordem: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
    }, {
        sequelize,
        modelName: 'Tamanho',
        tableName: 'tamanhos',
        paranoid: true,
        timestamps: true,
    });
    return Tamanho;
};
