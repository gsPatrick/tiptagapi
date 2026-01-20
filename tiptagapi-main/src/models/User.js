const { Model } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    class User extends Model {
        static associate(models) {
            // User can have many sales, stock movements, etc.
            // We will add associations in those models pointing to User.
        }

        checkPassword(password) {
            return bcrypt.compare(password, this.senha_hash);
        }
    }
    User.init({
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: { isEmail: true },
        },
        senha_hash: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        role: {
            type: DataTypes.ENUM('ADMIN', 'GERENTE', 'CAIXA', 'ESTOQUISTA'),
            defaultValue: 'CAIXA',
        },
        ativo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        paranoid: true,
        timestamps: true,
        hooks: {
            beforeCreate: async (user) => {
                if (user.senha_hash) {
                    user.senha_hash = await bcrypt.hash(user.senha_hash, 8);
                }
            },
            beforeUpdate: async (user) => {
                if (user.changed('senha_hash')) {
                    user.senha_hash = await bcrypt.hash(user.senha_hash, 8);
                }
            },
        },
    });
    return User;
};
