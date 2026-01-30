const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class FilaBot extends Model {
        static associate(models) {
            // Associations
        }
    }
    FilaBot.init({
        telefone: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        mensagem: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('PENDENTE', 'ENVIADO', 'ERRO'),
            defaultValue: 'PENDENTE',
        },
        data_envio: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        canal: {
            type: DataTypes.ENUM('WHATSAPP', 'EMAIL'),
            allowNull: false,
            defaultValue: 'WHATSAPP',
        },
        tipo: {
            type: DataTypes.ENUM('ALERTA_VENCIMENTO', 'PROMO', 'REPASSE', 'MATCH_PECA', 'POS_VENDA'),
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'FilaBot',
        tableName: 'fila_bot',
        paranoid: true,
        timestamps: true,
    });
    return FilaBot;
};
