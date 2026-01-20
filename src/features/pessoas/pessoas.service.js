const { Pessoa, Endereco, ContaBancariaPessoa, PerfilComportamental, CreditoLoja, PagamentoPedido, Pedido } = require('../../models');
const { Op } = require('sequelize');

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
        const { search, ...otherFilters } = filters;
        const where = { ...otherFilters };

        if (search) {
            where[Op.or] = [
                { nome: { [Op.iLike]: `%${search}%` } },
                { cpf_cnpj: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }

        return await Pessoa.findAll({
            where,
            include: ['endereco', 'contasBancarias', 'perfilComportamental'],
            order: [['nome', 'ASC']]
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

    async getSaldoPermuta(pessoaId) {
        const creditos = await CreditoLoja.findAll({
            where: {
                clienteId: pessoaId,
                status: 'ATIVO',
                data_validade: { [Op.gte]: new Date() },
                valor: { [Op.gt]: 0 }
            },
            order: [['data_validade', 'ASC']]
        });

        const total = creditos.reduce((acc, c) => acc + parseFloat(c.valor), 0);
        const nextExpiration = creditos.length > 0 ? creditos[0].data_validade : null;

        // History: Usage
        const usos = await PagamentoPedido.findAll({
            where: { metodo: 'VOUCHER_PERMUTA' },
            include: [{
                model: Pedido,
                as: 'pedido',
                where: { clienteId: pessoaId },
                attributes: ['id', 'codigo_pedido', 'data_pedido']
            }],
            order: [['createdAt', 'DESC']]
        });

        const historico = usos.map(u => ({
            id: u.id,
            data: u.pedido ? u.pedido.data_pedido : u.createdAt,
            descricao: u.pedido ? `Abatimento Pedido ${u.pedido.codigo_pedido}` : 'Uso de Voucher',
            valor: parseFloat(u.valor),
            tipo: 'USO'
        }));

        return {
            saldo: total,
            proximoVencimento: nextExpiration,
            historico
        };
    }
}

module.exports = new PessoasService();
