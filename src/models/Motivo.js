const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Motivo extends Model {
        static associate(models) {
            // Associations
        }
    }
    Motivo.init({
        descricao: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'Motivo',
        tableName: 'motivos',
        paranoid: true,
        timestamps: true,
    });
    return Motivo;
};
