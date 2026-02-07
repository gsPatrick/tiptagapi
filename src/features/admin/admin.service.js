const { User, Configuracao } = require('../../models');

class AdminService {
    // Users
    async createUser(data) {
        // Check if email exists
        const existing = await User.findOne({ where: { email: data.email } });
        if (existing) throw new Error('Email already in use');

        return await User.create(data);
    }

    async getAllUsers() {
        return await User.findAll({ attributes: { exclude: ['senha_hash'] } });
    }

    async updateUser(id, data) {
        const user = await User.findByPk(id);
        if (!user) throw new Error('User not found');
        await user.update(data);
        return user;
    }

    async deleteUser(id) {
        const user = await User.findByPk(id);
        if (!user) throw new Error('User not found');
        await user.destroy();
        return true;
    }

    // Configurations
    async getAllConfigs() {
        return await Configuracao.findAll();
    }

    async updateConfig(chave, valor) {
        const config = await Configuracao.findByPk(chave);
        if (!config) {
            // Create if not exists
            return await Configuracao.create({ chave, valor });
        }
        await config.update({ valor });
        return config;
    }

    async bulkUpdateConfigs(configs) {
        // configs is an array of { chave, valor } or an object { key: value }
        // Let's support both but assume object for better FE DX
        const entries = Array.isArray(configs) ? configs : Object.entries(configs).map(([chave, valor]) => ({ chave, valor }));

        const results = [];
        for (const { chave, valor } of entries) {
            const result = await this.updateConfig(chave, valor);
            results.push(result);
        }
        return results;
    }
}

module.exports = new AdminService();
