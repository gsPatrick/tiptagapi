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
        const start = Date.now();
        // Clona e limpa filtros para evitar prototype null issues do Express
        const { limit, page, order, ...where } = filters;
        const search = where.search;
        const simple = where.simple;

        // Remove chaves especiais do where
        delete where.search;
        delete where.simple;

        if (search) {
            where[Op.or] = [
                { nome: { [Op.iLike]: `%${search}%` } },
                { cpf_cnpj: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const queryOptions = {
            where,
            order: [['nome', 'ASC']]
        };

        if (limit) queryOptions.limit = parseInt(limit);
        if (order) queryOptions.order = [['nome', order.toUpperCase()]];

        // Simple Mode: Return only id and name
        if (simple === 'true' || simple === true) {
            queryOptions.attributes = ['id', 'nome'];
        } else {
            queryOptions.include = ['endereco', 'contasBancarias', 'perfilComportamental'];
        }

        try {
            // Pagination Logic
            if (page) {
                const limitVal = parseInt(limit) || 20;
                const pageVal = parseInt(page) || 1;
                const offset = (pageVal - 1) * limitVal;

                queryOptions.limit = limitVal;
                queryOptions.offset = offset;

                // Count might be expensive with includes, but necessary
                const { count, rows } = await Pessoa.findAndCountAll(queryOptions);

                console.log(`[PessoasService] GetAll (Paginated) completed in ${Date.now() - start}ms. Items: ${rows.length}`);

                return {
                    data: rows,
                    total: count,
                    page: pageVal,
                    totalPages: Math.ceil(count / limitVal)
                };
            }

            const items = await Pessoa.findAll(queryOptions);
            console.log(`[PessoasService] GetAll completed in ${Date.now() - start}ms. Items: ${items.length}`);
            return items;
        } catch (error) {
            console.error('[PessoasService] Error in getAll:', error);
            throw error;
        }
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
        const { ContaCorrentePessoa } = require('../../models');

        // 1. CreditoLoja (Store Vouchers for CLIENTS)
        const creditos = await CreditoLoja.findAll({
            where: {
                clienteId: pessoaId,
                status: 'ATIVO',
                data_validade: { [Op.gte]: new Date() },
                valor: { [Op.gt]: 0 }
            },
            order: [['data_validade', 'ASC']]
        });

        const totalCreditoLoja = creditos.reduce((acc, c) => acc + parseFloat(c.valor), 0);
        const nextExpiration = creditos.length > 0 ? creditos[0].data_validade : null;

        // 2. ContaCorrentePessoa (Supplier Commissions for FORNECEDORES)
        // This allows suppliers to use their commission balance for purchases (PERMUTA)
        const contaCredits = await ContaCorrentePessoa.sum('valor', {
            where: { pessoaId, tipo: 'CREDITO' }
        }) || 0;
        const contaDebits = await ContaCorrentePessoa.sum('valor', {
            where: { pessoaId, tipo: 'DEBITO' }
        }) || 0;
        const saldoContaCorrente = contaCredits - contaDebits;

        // Combined Saldo = CreditoLoja + ContaCorrentePessoa
        const saldoTotal = totalCreditoLoja + Math.max(0, saldoContaCorrente);

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
            saldo: saldoTotal,
            saldoCreditoLoja: totalCreditoLoja,
            saldoContaCorrente: Math.max(0, saldoContaCorrente),
            proximoVencimento: nextExpiration,
            historico
        };
    }
}

module.exports = new PessoasService();
