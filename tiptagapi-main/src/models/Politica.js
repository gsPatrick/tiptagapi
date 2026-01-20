const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Politica extends Model {
        static associate(models) {
            // Associations
        }
    }
    Politica.init({
        referencia: {
            type: DataTypes.STRING, // e.g., CONSULTAR, NORMAL
            allowNull: false,
        },
        descricao: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'Politica',
        tableName: 'politicas',
        paranoid: true,
        timestamps: true,
    });
    return Politica;
};
