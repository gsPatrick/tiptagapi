const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Pessoa extends Model {
        static associate(models) {
            Pessoa.hasOne(models.Endereco, { foreignKey: 'pessoaId', as: 'endereco' });
            Pessoa.hasMany(models.ContaBancariaPessoa, { foreignKey: 'pessoaId', as: 'contasBancarias' });
            Pessoa.hasOne(models.PerfilComportamental, { foreignKey: 'pessoaId', as: 'perfilComportamental' });
            Pessoa.hasMany(models.ContaCorrentePessoa, { foreignKey: 'pessoaId', as: 'movimentacoesConta' });
            Pessoa.hasMany(models.CreditoLoja, { foreignKey: 'clienteId', as: 'creditos' });
        }
    }
    Pessoa.init({
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        tipo: {
            type: DataTypes.ENUM('PF', 'PJ'),
            defaultValue: 'PF',
        },
        cpf_cnpj: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
        },
        rg_ie: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
            validate: { isEmail: true },
        },
        telefone_whatsapp: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        data_nascimento: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        // Flags
        is_cliente: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        is_fornecedor: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        // Consignação
        comissao_padrao: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 50.00,
        },
        dia_fechamento_pagamento: {
            type: DataTypes.INTEGER,
            defaultValue: 15,
        },
        dados_pix: {
            type: DataTypes.STRING, // Chave Pix
            allowNull: true,
        },
        // Perfil
        score_rfv: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        tamanhos_interesse: {
            type: DataTypes.JSON,
            defaultValue: [],
        },
        marcas_interesse: {
            type: DataTypes.JSON,
            defaultValue: [],
        },
    }, {
        sequelize,
        modelName: 'Pessoa',
        tableName: 'pessoas',
        paranoid: true,
        timestamps: true,
    });
    return Pessoa;
};
