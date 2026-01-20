const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PerfilComportamental extends Model {
        static associate(models) {
            PerfilComportamental.belongsTo(models.Pessoa, { foreignKey: 'pessoaId', as: 'pessoa' });
        }
    }
    PerfilComportamental.init({
        pessoaId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'pessoas',
                key: 'id',
            },
        },
        estilos_preferidos: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        cores_favoritas: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        score_estilo: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
    }, {
        sequelize,
        modelName: 'PerfilComportamental',
        tableName: 'perfis_comportamentais',
        paranoid: true,
        timestamps: true,
    });
    return PerfilComportamental;
};
