const { Pessoa, Endereco, ContaBancariaPessoa, PerfilComportamental } = require('../../models');

class PessoasService {
    async create(data) {
        const { endereco, contasBancarias, perfilComportamental, ...pessoaData } = data;

        const pessoa = await Pessoa.create(pessoaData);

        if (endereco) {
            await Endereco.create({ ...endereco, pessoaId: pessoa.id });
        }

        if (contasBancarias && contasBancarias.length > 0) {
            const contas = contasBancarias.map(c => ({ ...c, pessoaId: pessoa.id }));
            await ContaBancariaPessoa.bulkCreate(contas);
        }

        if (perfilComportamental) {
            await PerfilComportamental.create({ ...perfilComportamental, pessoaId: pessoa.id });
        }

        return this.getById(pessoa.id);
    }

    async getAll(filters = {}) {
        return await Pessoa.findAll({
            where: filters,
            include: ['endereco', 'contasBancarias', 'perfilComportamental'],
        });
    }

    async getById(id) {
        return await Pessoa.findByPk(id, {
            include: ['endereco', 'contasBancarias', 'perfilComportamental'],
        });
    }

    async update(id, data) {
        const pessoa = await Pessoa.findByPk(id);
        if (!pessoa) throw new Error('Pessoa not found');

        const { endereco, contasBancarias, perfilComportamental, ...pessoaData } = data;

        await pessoa.update(pessoaData);

        if (endereco) {
            const existingEndereco = await Endereco.findOne({ where: { pessoaId: id } });
            if (existingEndereco) {
                await existingEndereco.update(endereco);
            } else {
                await Endereco.create({ ...endereco, pessoaId: id });
            }
        }

        // For simplicity, we are not handling full sync of nested arrays here, just addition or update if logic provided.
        // In a real app, we might need to delete removed accounts.

        return this.getById(id);
    }

    async delete(id) {
        const pessoa = await Pessoa.findByPk(id);
        if (!pessoa) throw new Error('Pessoa not found');
        await pessoa.destroy();
        return { message: 'Pessoa deleted successfully' };
    }
}

module.exports = new PessoasService();
