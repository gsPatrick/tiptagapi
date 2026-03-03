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
            allowNull: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        assunto: {
            type: DataTypes.STRING,
            allowNull: true,
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
            type: DataTypes.STRING,
            allowNull: true,
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
