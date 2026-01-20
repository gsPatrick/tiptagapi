const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Categoria extends Model {
        static associate(models) {
            // Associations
        }
    }
    Categoria.init({
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        foto: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'Categoria',
        tableName: 'categorias',
        paranoid: true,
        timestamps: true,
    });
    return Categoria;
};
