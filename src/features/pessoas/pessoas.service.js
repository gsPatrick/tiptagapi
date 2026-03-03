const { Pessoa, Endereco, ContaBancariaPessoa, PerfilComportamental, CreditoLoja, PagamentoPedido, Pedido, ContratoPessoa, ContaCorrentePessoa, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { startOfMonth, subMonths } = require('date-fns');
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
        const includeSimple = simple === 'true' || simple === true;

        // Calculate balances and map results
        let result = pessoas.map(p => {
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

        // Apply has_credit filter if requested
        if (filters.has_credit === 'true' || filters.has_credit === true) {
            result = result.filter(p => p.saldo > 0);
        }

        return result;
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

        // Sanitize date fields - convert invalid values to null
        const dateFields = ['data_nascimento'];
        dateFields.forEach(field => {
            if (pessoaData[field] !== undefined) {
                const val = pessoaData[field];
                if (!val || val === '' || val === 'Invalid date' || val === 'Invalid Date' || isNaN(new Date(val).getTime())) {
                    pessoaData[field] = null;
                }
            }
        });

        // Sanitize unique fields - convert empty strings to null to avoid unique constraint errors
        const uniqueFields = ['email', 'cpf_cnpj'];
        uniqueFields.forEach(field => {
            if (pessoaData[field] !== undefined && (!pessoaData[field] || pessoaData[field].trim() === '')) {
                pessoaData[field] = null;
            }
        });

        // Sanitize numeric fields
        if (pessoaData.dia_fechamento_pagamento !== undefined) {
            const val = parseInt(pessoaData.dia_fechamento_pagamento);
            pessoaData.dia_fechamento_pagamento = isNaN(val) ? 15 : val;
        }
        if (pessoaData.comissao_padrao !== undefined) {
            const val = parseFloat(pessoaData.comissao_padrao);
            pessoaData.comissao_padrao = isNaN(val) ? 50.00 : val;
        }

        await pessoa.update(pessoaData);

        if (endereco) {
            const existingEndereco = await Endereco.findOne({ where: { pessoaId: id } });
            if (existingEndereco) {
                await existingEndereco.update(endereco);
            } else {
                await Endereco.create({ ...endereco, pessoaId: id });
            }
        }

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

        // Total Consolidated = CreditoLoja + ContaCorrentePessoa (Month M-1 or older)
        const currentMonthStart = startOfMonth(new Date());

        const consolidatedCCSaldo = await ContaCorrentePessoa.findAll({
            attributes: [
                [sequelize.fn('SUM', sequelize.literal("CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END")), 'saldo']
            ],
            where: {
                pessoaId,
                data_movimento: { [Op.lt]: currentMonthStart }
            },
            raw: true
        });

        const pendingCCSaldo = await ContaCorrentePessoa.findAll({
            attributes: [
                [sequelize.fn('SUM', sequelize.literal("CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END")), 'saldo']
            ],
            where: {
                pessoaId,
                tipo: 'CREDITO',
                data_movimento: { [Op.gte]: currentMonthStart }
            },
            raw: true
        });

        const saldoConsolidado = (parseFloat(totalCreditoLoja) || 0) + (parseFloat(consolidatedCCSaldo[0]?.saldo) || 0);
        const saldoPendente = parseFloat(pendingCCSaldo[0]?.saldo) || 0;

        // History: Usage (Payments) + CC Movements (Debits)
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

        // Fetch all CC movements for history (Debits/Resets)
        const ccMovements = await ContaCorrentePessoa.findAll({
            where: { pessoaId },
            order: [['data_movimento', 'DESC']]
        });

        const historico = [
            ...usos.map(u => ({
                id: `u-${u.id}`,
                data: u.pedido ? u.pedido.data_pedido : u.createdAt,
                descricao: u.pedido ? `Abatimento Pedido ${u.pedido.codigo_pedido}` : 'Uso de Voucher',
                valor: parseFloat(u.valor),
                tipo: 'USO'
            })),
            ...ccMovements.filter(m => m.tipo === 'DEBITO').map(m => ({
                id: `m-${m.id}`,
                data: m.data_movimento,
                descricao: m.descricao || 'Débito em Conta',
                valor: parseFloat(m.valor),
                tipo: 'DEBITO'
            }))
        ].sort((a, b) => new Date(b.data) - new Date(a.data));

        // Group detailing by month based on CREDITO movements
        const monthlyGroups = {};
        const getGroup = (date, isPending) => {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyGroups[key]) {
                monthlyGroups[key] = {
                    key,
                    mes: date.getMonth() + 1,
                    ano: date.getFullYear(),
                    valor: 0,
                    status: isPending ? 'PENDENTE' : 'DISPONIVEL',
                    pecas: [],
                    outros: []
                };
            }
            return monthlyGroups[key];
        };

        const { Peca } = require('../../models');
        const ccCredits = ccMovements.filter(m => m.tipo === 'CREDITO');
        const pecaIds = ccCredits.map(m => m.referencia_origem).filter(id => !!id);

        const pecasMap = {};
        if (pecaIds.length > 0) {
            const pcs = await Peca.findAll({
                where: { id: { [Op.in]: pecaIds } }
            });
            pcs.forEach(p => { pecasMap[p.id] = p; });
        }

        // 1. Process CC Credits (Most items and adjustments)
        ccCredits.forEach(cc => {
            const date = new Date(cc.data_movimento);
            const isPending = date >= currentMonthStart;
            const group = getGroup(date, isPending);
            
            const val = parseFloat(cc.valor);
            group.valor += val;

            if (cc.referencia_origem && pecasMap[cc.referencia_origem]) {
                const p = pecasMap[cc.referencia_origem];
                group.pecas.push({
                    id: p.id,
                    codigo: p.codigo_etiqueta,
                    descricao: p.descricao_curta,
                    valor_venda: parseFloat(p.valor_venda_final || p.preco_venda || 0),
                    comissao: val,
                    data: cc.data_movimento
                });
            } else {
                group.outros.push({
                    descricao: cc.descricao,
                    valor: val
                });
            }
        });

        // 2. Process CreditoLoja (Vouchers/Cups)
        creditos.forEach(c => {
            const date = new Date(c.createdAt || c.data_validade);
            const group = getGroup(date, false);
            group.valor += parseFloat(c.valor);
            group.outros.push({
                descricao: `Crédito Loja / Cupom`,
                valor: parseFloat(c.valor)
            });
        });

        const detalhamento = [];
        Object.keys(monthlyGroups).sort().reverse().forEach(key => {
            detalhamento.push(monthlyGroups[key]);
        });

        return {
            saldo: saldoConsolidado, // What can be used now
            saldoPendente, // What is being accrued this month
            saldoCreditoLoja: totalCreditoLoja,
            saldoContaCorrente: saldoConsolidado - totalCreditoLoja,
            proximoVencimento: nextExpiration,
            historico,
            detalhamento
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
