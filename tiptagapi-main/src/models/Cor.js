const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Cor extends Model {
        static associate(models) {
            // Associations
        }
    }
    Cor.init({
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        hex: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'Cor',
        tableName: 'cores',
        paranoid: true,
        timestamps: true,
    });
    return Cor;
};
