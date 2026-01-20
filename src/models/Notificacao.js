const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Notificacao extends Model {
        static associate(models) {
            // Define associations here if needed
        }
    }
    Notificacao.init({
        mensagem: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        tipo: {
            type: DataTypes.ENUM('ALERTA', 'INFO', 'ERRO', 'SUCESSO'),
            defaultValue: 'INFO',
        },
        lida: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        data_criacao: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        sequelize,
        modelName: 'Notificacao',
        tableName: 'notificacoes',
        timestamps: true,
    });
    return Notificacao;
};
