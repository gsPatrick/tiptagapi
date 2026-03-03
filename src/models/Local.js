const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Local extends Model {
        static associate(models) {
            // Associations
        }
    }
    Local.init({
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'Local',
        tableName: 'locais',
        paranoid: true,
        timestamps: true,
    });
    return Local;
};
