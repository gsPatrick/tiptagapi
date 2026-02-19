const { Pessoa, Endereco, ContaBancariaPessoa, PerfilComportamental, CreditoLoja, PagamentoPedido, Pedido, ContratoPessoa } = require('../../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

class PessoasService {
    async create(data) {
        const { endereco, contasBancarias, perfilComportamental, ...pessoaData } = data;

        // Check if exists (paranoid: false to include deleted)
        let pessoa = await Pessoa.findOne({
            where: {
                [Op.or]: [
                    { cpf_cnpj: pessoaData.cpf_cnpj },
                    { email: pessoaData.email }
                ]
            },
            paranoid: false
        });

        if (pessoa) {
            if (pessoa.deletedAt) {
                // Restore and update
                await pessoa.restore();
                await pessoa.update(pessoaData);
            } else {
                // Determine which field is duplicate
                if (pessoa.cpf_cnpj === pessoaData.cpf_cnpj) throw new Error('CPF/CNPJ já cadastrado.');
                if (pessoa.email === pessoaData.email) throw new Error('E-mail já cadastrado.');
            }
        } else {
            // Create new
            pessoa = await Pessoa.create(pessoaData);
        }

        if (endereco) {
            const existingEndereco = await Endereco.findOne({ where: { pessoaId: pessoa.id } });
            if (existingEndereco) {
                await existingEndereco.update(endereco);
            } else {
                await Endereco.create({ ...endereco, pessoaId: pessoa.id });
            }
        }

        if (contasBancarias && contasBancarias.length > 0) {
            // Clear old ones if restoring, or just add new ones? 
            // For simplicity in restore scenario, we might want to keep old ones or wipe them.
            // Let's destroy existing to ensure clean state on restore
            await ContaBancariaPessoa.destroy({ where: { pessoaId: pessoa.id } });

            const contas = contasBancarias.map(c => ({ ...c, pessoaId: pessoa.id }));
            await ContaBancariaPessoa.bulkCreate(contas);
        }

        if (perfilComportamental) {
            const existingPerfil = await PerfilComportamental.findOne({ where: { pessoaId: pessoa.id } });
            if (existingPerfil) {
                await existingPerfil.update(perfilComportamental);
            } else {
                await PerfilComportamental.create({ ...perfilComportamental, pessoaId: pessoa.id });
            }
        }

        return this.getById(pessoa.id);
    }

    async getAll(filters = {}) {
        const { search, simple, ...otherFilters } = filters;
        const where = {};

        // Sanitize: allow only valid Pessoa fields for filtering
        const allowedFilters = ['is_cliente', 'is_fornecedor', 'tipo', 'email', 'cpf_cnpj', 'rg_ie'];
        allowedFilters.forEach(key => {
            if (otherFilters[key] !== undefined) {
                where[key] = otherFilters[key];
            }
        });

        // Convert common string booleans from query params
        ['is_cliente', 'is_fornecedor'].forEach(key => {
            if (where[key] !== undefined && typeof where[key] === 'string') {
                where[key] = where[key].toLowerCase() === 'true';
            }
        });

        if (search) {
            where[Op.or] = [
                { nome: { [Op.iLike]: `%${search}%` } },
                { cpf_cnpj: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const options = {
            where,
            order: [['nome', 'ASC']]
        };

        // If simple=true, return only essential fields without heavy associations
        if (simple === 'true' || simple === true) {
            options.attributes = ['id', 'nome', 'cpf_cnpj', 'email', 'telefone_whatsapp', 'tipo', 'is_cliente', 'is_fornecedor'];
        } else {
            options.include = [
                'endereco',
                'contasBancarias',
                'perfilComportamental',
                {
                    model: require('../../models').ContaCorrentePessoa,
                    as: 'movimentacoesConta',
                    attributes: ['tipo', 'valor']
                },
                {
                    model: require('../../models').CreditoLoja,
                    as: 'creditos',
                    where: {
                        status: 'ATIVO',
                        data_validade: { [Op.gte]: new Date() }
                    },
                    required: false,
                    attributes: ['valor']
                }
            ];
        }

        const pessoas = await Pessoa.findAll(options);

        // Calculate balances
        return pessoas.map(p => {
            const person = p.toJSON();

            // 1. Supplier Balance (ContaCorrentePessoa)
            let saldoContaCorrente = 0;
            if (person.movimentacoesConta) {
                person.movimentacoesConta.forEach(m => {
                    if (m.tipo === 'CREDITO') saldoContaCorrente += parseFloat(m.valor);
                    else saldoContaCorrente -= parseFloat(m.valor);
                });
            }

            // 2. Client Balance (CreditoLoja)
            let saldoCreditoLoja = 0;
            if (person.creditos) {
                person.creditos.forEach(c => {
                    saldoCreditoLoja += parseFloat(c.valor);
                });
            }

            person.saldo = saldoCreditoLoja + Math.max(0, saldoContaCorrente);
            person.saldoContaCorrente = saldoContaCorrente;
            person.saldoCreditoLoja = saldoCreditoLoja;

            return person;
        });
    }

    async getById(id) {
        return await Pessoa.findByPk(id, {
            include: ['endereco', 'contasBancarias', 'perfilComportamental', 'contratos'],
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

    // Contracts
    async addContrato(pessoaId, fileData) {
        return await ContratoPessoa.create({
            pessoaId,
            ...fileData
        });
    }

    async updateContrato(contratoId, data) {
        const contrato = await ContratoPessoa.findByPk(contratoId);
        if (!contrato) throw new Error('Contrato not found');
        await contrato.update(data);
        return contrato;
    }

    async deleteContrato(contratoId) {
        const contrato = await ContratoPessoa.findByPk(contratoId);
        if (!contrato) throw new Error('Contrato not found');

        // Delete file from disk
        const filePath = contrato.caminho;
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await contrato.destroy();
        return { message: 'Contrato deleted successfully' };
    }
}

module.exports = new PessoasService();
