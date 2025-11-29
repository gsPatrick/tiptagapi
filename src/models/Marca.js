const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Marca extends Model {
        static associate(models) {
            // Associations
        }
    }
    Marca.init({
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'Marca',
        tableName: 'marcas',
        paranoid: true,
        timestamps: true,
    });
    return Marca;
};
