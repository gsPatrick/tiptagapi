const {
    Pedido, ItemPedido, PagamentoPedido, Peca,
    ContaCorrentePessoa, CreditoLoja, Pessoa, Sacolinha,
    MovimentacaoEstoque, CaixaDiario, Configuracao, sequelize, User
} = require('../../models');
const { Op } = require('sequelize');
const { addMonths, setDate, setHours, setMinutes, setSeconds, isAfter } = require('date-fns');
const automacaoService = require('../automacao/automacao.service');

class VendasService {
    async processarVendaPDV(data, userId) {
        const { clienteId, itens, pagamentos, origemVendaId, canal } = data;

        const caixaAberto = await CaixaDiario.findOne({
            where: { userId, status: 'ABERTO' }
        });
        if (!caixaAberto) {
            throw new Error('Caixa fechado. Abra o caixa antes de realizar vendas.');
        }

        const t = await sequelize.transaction();

        try {
            const pedido = await Pedido.create({
                codigo_pedido: `PDV-${Date.now()}`,
                clienteId,
                vendedorId: userId,
                origem: 'PDV',
                status: 'PAGO',
                data_pedido: new Date(),
            }, { transaction: t });

            let subtotal = 0;

            for (const item of itens) {
                const peca = await Peca.findByPk(item.pecaId, { transaction: t });

                if (!peca || !['DISPONIVEL', 'A_VENDA'].includes(peca.status)) {
                    throw new Error(`Peça ${item.pecaId} indisponível`);
                }

                const valorVenda = item.valor_unitario_venda || peca.preco_venda;
                subtotal += parseFloat(valorVenda);

                await peca.update({
                    status: 'VENDIDA',
                    data_venda: new Date(),
                    data_saida_estoque: new Date(),
                }, { transaction: t });

                await MovimentacaoEstoque.create({
                    pecaId: peca.id,
                    userId,
                    tipo: 'SAIDA_VENDA',
                    quantidade: -1,
                    motivo: `Venda PDV Pedido ${pedido.codigo_pedido}`,
                    data_movimento: new Date(),
                }, { transaction: t });

                await ItemPedido.create({
                    pedidoId: pedido.id,
                    pecaId: peca.id,
                    valor_unitario_final: valorVenda,
                }, { transaction: t });

                if (peca.tipo_aquisicao === 'CONSIGNACAO' && peca.fornecedorId) {
                    const fornecedor = await Pessoa.findByPk(peca.fornecedorId, { transaction: t });
                    const comissaoPercent = fornecedor.comissao_padrao || 50;
                    const valorCredito = (valorVenda * comissaoPercent) / 100;

                    await ContaCorrentePessoa.create({
                        pessoaId: peca.fornecedorId,
                        tipo: 'CREDITO',
                        valor: valorCredito,
                        descricao: `Venda peça ${peca.codigo_etiqueta}`,
                        referencia_origem: peca.id,
                        data_movimento: new Date(),
                    }, { transaction: t });
                }
            }

            let totalPago = 0;
            for (const pag of pagamentos) {
                await PagamentoPedido.create({
                    pedidoId: pedido.id,
                    metodo: pag.metodo,
                    valor: pag.valor,
                    parcelas: pag.parcelas || 1,
                }, { transaction: t });

                totalPago += parseFloat(pag.valor);

                if (pag.metodo === 'CREDITO_LOJA' && clienteId) {
                    await ContaCorrentePessoa.create({
                        pessoaId: clienteId,
                        tipo: 'DEBITO',
                        valor: pag.valor,
                        descricao: `Uso de crédito Pedido ${pedido.codigo_pedido}`,
                        referencia_origem: pedido.id,
                    }, { transaction: t });
                }

                if (pag.metodo === 'DINHEIRO') {
                    const novoTotal = parseFloat(caixaAberto.total_entradas_dinheiro) + parseFloat(pag.valor);
                    await caixaAberto.update({ total_entradas_dinheiro: novoTotal }, { transaction: t });
                }
            }

            await pedido.update({
                subtotal,
                total: totalPago,
            }, { transaction: t });

            // --- CASHBACK LOGIC ---
            if (clienteId) {
                const configDia = await Configuracao.findByPk('CASHBACK_DIA_RESET', { transaction: t });
                const configHora = await Configuracao.findByPk('CASHBACK_HORA_RESET', { transaction: t });

                const diaReset = configDia ? parseInt(configDia.valor) : 1;
                const horaResetStr = configHora ? configHora.valor : '00:00';
                const [horaReset, minReset] = horaResetStr.split(':').map(Number);

                const now = new Date();
                let validade = setDate(now, diaReset);
                validade = setHours(validade, horaReset || 0);
                validade = setMinutes(validade, minReset || 0);
                validade = setSeconds(validade, 0);

                if (isAfter(now, validade)) {
                    validade = addMonths(validade, 1);
                }

                const cashbackPercent = 10;
                const valorCashback = (totalPago * cashbackPercent) / 100;

                if (valorCashback > 0) {
                    await CreditoLoja.create({
                        clienteId,
                        valor: valorCashback,
                        data_validade: validade,
                        status: 'ATIVO',
                        codigo_cupom: `CASHBACK-${pedido.codigo_pedido}`
                    }, { transaction: t });
                }
            }
            // ----------------------

            await t.commit();

            // --- NOTIFICATION TRIGGER (Dynamic) ---
            if (clienteId) {
                const cliente = await Pessoa.findByPk(clienteId);
                if (cliente && cliente.telefone_whatsapp) {
                    await automacaoService.agendarMensagem({
                        telefone: cliente.telefone_whatsapp,
                        canal: 'WHATSAPP',
                        gatilho: 'POS_VENDA',
                        variaveis: {
                            NOME_CLIENTE: cliente.nome,
                            CODIGO_PEDIDO: pedido.codigo_pedido,
                            VALOR_TOTAL: totalPago.toFixed(2)
                        },
                        // Fallback message if template not found
                        mensagem: `Olá ${cliente.nome}, seu pedido ${pedido.codigo_pedido} foi confirmado! Valor: R$ ${totalPago.toFixed(2)}.`
                    });
                }
            }
            // -------------------------------------------

            return pedido;

        } catch (err) {
            await t.rollback();
            throw err;
        }
    }

    async abrirSacolinha(clienteId) {
        return await Sacolinha.create({
            clienteId,
            status: 'ABERTA',
            data_abertura: new Date(),
        });
    }

    async adicionarItemSacolinha(sacolinhaId, pecaId) {
        const sacolinha = await Sacolinha.findByPk(sacolinhaId);
        if (!sacolinha) throw new Error('Sacolinha not found');

        const peca = await Peca.findByPk(pecaId);
        if (!peca || !['DISPONIVEL', 'A_VENDA'].includes(peca.status)) throw new Error('Peça indisponível');

        await peca.update({ status: 'RESERVADA_SACOLINHA' });
        return sacolinha;
    }

    async fecharSacolinha(sacolinhaId) {
        const sacolinha = await Sacolinha.findByPk(sacolinhaId);
        if (!sacolinha) throw new Error('Sacolinha not found');
        await sacolinha.update({ status: 'FECHADA_VIRAR_PEDIDO' });
        return { message: 'Sacolinha pronta para virar pedido' };
    }

    async getSacolinhas(filters = {}) {
        const where = {};
        if (filters.status && filters.status !== 'all') where.status = filters.status.toUpperCase();
        if (filters.search) {
            // Assuming search by client name. Need to include Pessoa and filter.
            // Complex query or just filter by client name if included.
        }

        return await Sacolinha.findAll({
            where,
            include: [
                {
                    model: Pessoa,
                    as: 'cliente',
                    where: filters.search ? {
                        nome: { [Op.like]: `%${filters.search}%` }
                    } : undefined
                },
                { model: Peca, as: 'itens' } // Assuming association exists
            ],
            order: [['createdAt', 'DESC']]
        });
    }

    async getItensVendidos(search) {
        if (!search) return [];

        // Search Peca by code/name or Client by name
        // This is a bit complex because we need to join ItemPedido -> Pedido -> Pessoa
        // and ItemPedido -> Peca

        return await ItemPedido.findAll({
            include: [
                {
                    model: Pedido,
                    as: 'pedido',
                    include: [{ model: Pessoa, as: 'cliente' }, { model: User, as: 'vendedor' }]
                },
                {
                    model: Peca,
                    as: 'peca',
                    where: {
                        [Op.or]: [
                            { codigo_etiqueta: { [Op.like]: `%${search}%` } },
                            { descricao_curta: { [Op.like]: `%${search}%` } }
                        ],
                        status: 'VENDIDA' // Only sold items
                    }
                }
            ],
            limit: 20,
            order: [['createdAt', 'DESC']]
        });
    }

    async processarDevolucao(pecaId, userId) {
        const t = await sequelize.transaction();
        try {
            const peca = await Peca.findByPk(pecaId);
            if (!peca || peca.status !== 'VENDIDA') throw new Error('Peça não está vendida');

            const itemPedido = await ItemPedido.findOne({
                where: { pecaId },
                order: [['createdAt', 'DESC']],
                include: [{ model: Pedido, as: 'pedido' }]
            });

            if (!itemPedido) throw new Error('Venda não encontrada para esta peça');

            // Update Peca
            await peca.update({ status: 'DISPONIVEL' }, { transaction: t });

            // Create Stock Movement
            await MovimentacaoEstoque.create({
                pecaId,
                userId,
                tipo: 'ENTRADA_DEVOLUCAO',
                quantidade: 1,
                motivo: `Devolução Venda ${itemPedido.pedido.codigo_pedido}`,
                data_movimento: new Date()
            }, { transaction: t });

            // Generate Credit for Client
            if (itemPedido.pedido.clienteId) {
                await CreditoLoja.create({
                    clienteId: itemPedido.pedido.clienteId,
                    valor: itemPedido.valor_unitario_final,
                    data_validade: addMonths(new Date(), 6),
                    status: 'ATIVO',
                    codigo_cupom: `DEV-${peca.codigo_etiqueta}-${Date.now()}`
                }, { transaction: t });
            }

            await t.commit();
            return { message: 'Devolução processada com sucesso' };
        } catch (err) {
            await t.rollback();
            throw err;
        }
    }

    async getDevolucoes() {
        return await MovimentacaoEstoque.findAll({
            where: { tipo: 'ENTRADA_DEVOLUCAO' },
            include: [
                { model: Peca, as: 'peca' },
                { model: User, as: 'usuario' } // Employee who processed
            ],
            order: [['data_movimento', 'DESC']]
        });
    }

    async getPedidos(filters = {}) {
        const whereClause = {
            status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] }
        };

        if (filters.search) {
            whereClause[Op.or] = [
                { codigo_pedido: { [Op.like]: `%${filters.search}%` } },
                { '$cliente.nome$': { [Op.like]: `%${filters.search}%` } }
            ];
        }

        if (filters.inicio && filters.fim) {
            whereClause.data_pedido = { [Op.between]: [new Date(filters.inicio), new Date(filters.fim)] };
        }

        const pedidos = await Pedido.findAll({
            where: whereClause,
            include: [
                { model: Pessoa, as: 'cliente', attributes: ['nome'] },
                { model: User, as: 'vendedor', attributes: ['nome'] },
                { model: PagamentoPedido, as: 'pagamentos', attributes: ['metodo'] },
                {
                    model: ItemPedido,
                    as: 'itens',
                    include: [{ model: Peca, as: 'peca', attributes: ['descricao_curta', 'codigo_etiqueta'], include: [{ model: Pessoa, as: 'fornecedor', attributes: ['nome'] }] }]
                }
            ],
            order: [['data_pedido', 'DESC']]
        });

        return pedidos.map(p => ({
            id: p.id,
            codigo: p.codigo_pedido,
            data: new Date(p.data_pedido).toLocaleDateString('pt-BR'),
            vendedor: p.vendedor ? p.vendedor.nome : 'LOJA',
            cliente: p.cliente ? p.cliente.nome : 'CONSUMIDOR FINAL',
            pagamento: p.pagamentos && p.pagamentos.length > 0 ? p.pagamentos.map(pg => pg.metodo).join(', ') : 'PENDENTE',
            valor: parseFloat(p.total || 0),
            status: p.status,
            itens: p.itens.map(i => ({
                id: i.peca ? i.peca.codigo_etiqueta : 'N/A',
                desc: i.peca ? i.peca.descricao_curta : 'ITEM REMOVIDO',
                fornecedor: i.peca && i.peca.fornecedor ? i.peca.fornecedor.nome : 'LOJA',
                preco: parseFloat(i.valor_unitario_final || 0)
            }))
        }));
    }
}

module.exports = new VendasService();
