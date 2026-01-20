const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class FotoPeca extends Model {
        static associate(models) {
            FotoPeca.belongsTo(models.Peca, { foreignKey: 'pecaId', as: 'peca' });
        }
    }
    FotoPeca.init({
        pecaId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'pecas',
                key: 'id',
            },
        },
        url: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        ordem: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        is_principal: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    }, {
        sequelize,
        modelName: 'FotoPeca',
        tableName: 'fotos_peca',
        paranoid: true,
        timestamps: true,
    });
    return FotoPeca;
};
