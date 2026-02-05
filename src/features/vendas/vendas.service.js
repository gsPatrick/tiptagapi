const {
    Pedido, ItemPedido, PagamentoPedido, Peca,
    ContaCorrentePessoa, CreditoLoja, Pessoa, Sacolinha,
    MovimentacaoEstoque, CaixaDiario, Configuracao, sequelize, User
} = require('../../models');
const { Op } = require('sequelize');
const { addMonths, addDays, setDate, setHours, setMinutes, setSeconds, isAfter, endOfMonth } = require('date-fns');
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
            const itensResumo = []; // Store item details for message

            for (const item of itens) {
                const peca = await Peca.findByPk(item.pecaId, { transaction: t });

                if (!peca || !['DISPONIVEL', 'A_VENDA', 'NOVA'].includes(peca.status)) {
                    throw new Error(`Peça ${item.pecaId} indisponível`);
                }

                const valorVenda = item.valor_unitario_venda || peca.preco_venda;
                subtotal += parseFloat(valorVenda);
                itensResumo.push({ nome: peca.descricao_curta, valor: valorVenda });

                // Decrement Stock Logic
                const novaQuantidade = peca.quantidade - 1;
                const updateData = {
                    quantidade: novaQuantidade
                };

                if (novaQuantidade <= 0) {
                    updateData.status = 'VENDIDA';
                    updateData.data_venda = new Date();
                    updateData.data_saida_estoque = new Date();
                }

                await peca.update(updateData, { transaction: t });

                await MovimentacaoEstoque.create({
                    pecaId: peca.id,
                    userId,
                    tipo: 'SAIDA_VENDA',
                    quantidade: -1,
                    motivo: `Venda PDV Pedido ${pedido.codigo_pedido}`,
                    data_movimento: new Date(),
                }, { transaction: t });

                // Real-time Sync to Ecommerce (Update Stock)
                try {
                    // We need to do this AFTER transaction commit? Or inside?
                    // If we do it inside and it fails, we don't want to rollback the sale?
                    // Usually sync is "best effort" or background job.
                    // But here we want it "real-time".
                    // We can't await it inside transaction if it takes time.
                    // But for simplicity, let's put it in a list and execute after commit.
                    // Or just fire and forget inside (no await? but we want to log error).
                    // I'll add it to a post-commit hook or just fire it.
                    // Since I can't easily add post-commit hook here without refactoring,
                    // I'll collect items to sync and do it after commit.
                } catch (e) {
                    console.error('Sync error', e);
                }

                await ItemPedido.create({
                    pedidoId: pedido.id,
                    pecaId: peca.id,
                    valor_unitario_final: valorVenda,
                }, { transaction: t });

                if (peca.tipo_aquisicao === 'CONSIGNACAO' && peca.fornecedorId) {
                    const fornecedor = await Pessoa.findByPk(peca.fornecedorId, { transaction: t });

                    // FORCED RULE: Consignment is always 50%
                    const comissaoPercent = 50;
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

                if (peca.tipo_aquisicao === 'PERMUTA' && peca.fornecedorId) {
                    const fornecedor = await Pessoa.findByPk(peca.fornecedorId, { transaction: t });

                    // Regra: Default 50% se não houver específico no cadastro
                    const comissaoPercent = fornecedor && fornecedor.comissao_padrao
                        ? parseFloat(fornecedor.comissao_padrao)
                        : 50;

                    // Cálculo: (Valor Venda * Percentual) / 100
                    const valorCredito = (parseFloat(valorVenda) * comissaoPercent) / 50;

                    if (valorCredito > 0) {
                        const nextMonth = addMonths(new Date(), 1);
                        const validade = endOfMonth(nextMonth); // Last day of next month

                        await CreditoLoja.create({
                            clienteId: peca.fornecedorId,
                            valor: valorCredito,
                            data_validade: validade,
                            data_validade: validade,
                            status: 'AGUARDANDO_LIBERACAO', // Acumula para o próximo mês
                            codigo_cupom: `PERMUTA-${peca.codigo_etiqueta || Date.now()}`
                        }, { transaction: t });
                    }
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

                if (pag.metodo === 'VOUCHER_PERMUTA') {
                    if (!clienteId) throw new Error('Cliente não identificado para uso de Voucher Permuta.');

                    // Busca Segura
                    const creditosDisponiveis = await CreditoLoja.findAll({
                        where: {
                            clienteId,
                            status: 'ATIVO',
                            valor: { [Op.gt]: 0 },
                            data_validade: { [Op.gte]: new Date() } // Apenas válidos
                        },
                        order: [['data_validade', 'ASC']], // FIFO: Consome os que vencem primeiro
                        transaction: t
                    });

                    // Validação Rígida
                    const totalDisponivel = creditosDisponiveis.reduce((acc, c) => acc + parseFloat(c.valor), 0);
                    if (totalDisponivel < parseFloat(pag.valor)) {
                        throw new Error('Saldo de permuta insuficiente ou expirado.');
                    }

                    // Consumo (Loop de Débito)
                    let valorRestante = parseFloat(pag.valor);
                    for (const credito of creditosDisponiveis) {
                        if (valorRestante <= 0) break;

                        const valorCredito = parseFloat(credito.valor);

                        if (valorCredito >= valorRestante) {
                            const novoValor = valorCredito - valorRestante;
                            await credito.update({
                                valor: novoValor,
                                status: novoValor === 0 ? 'USADO' : 'ATIVO'
                            }, { transaction: t });
                            valorRestante = 0;
                        } else {
                            valorRestante -= valorCredito;
                            await credito.update({
                                valor: 0,
                                status: 'USADO'
                            }, { transaction: t });
                        }
                    }
                }

                if (pag.metodo === 'DINHEIRO') {
                    const novoTotal = parseFloat(caixaAberto.total_entradas_dinheiro) + parseFloat(pag.valor);
                    await caixaAberto.update({ total_entradas_dinheiro: novoTotal }, { transaction: t });
                }

                // --- RECORD FINANCIAL MOVEMENT ---
                if (clienteId && !['CREDITO_LOJA', 'VOUCHER_PERMUTA'].includes(pag.metodo)) {
                    const { MovimentacaoConta } = require('../../models');
                    await MovimentacaoConta.create({
                        pessoaId: clienteId,
                        tipo_transacao: 'CREDITO',
                        valor: pag.valor,
                        data_movimento: new Date(),
                        descricao: `Venda PDV ${pedido.codigo_pedido} - ${pag.metodo}`,
                        categoria: 'VENDA_PECA',
                        origem_id: pedido.id,
                        origem_tipo: 'PEDIDO'
                    }, { transaction: t });
                }
                // ---------------------------------
            }

            await pedido.update({
                subtotal,
                total: totalPago,
            }, { transaction: t });

            // --- CASHBACK LOGIC ---
            // Verifica se houve pagamento com Voucher ou Crédito Loja
            const pagouComCredito = pagamentos.some(p => ['VOUCHER_PERMUTA', 'CREDITO_LOJA'].includes(p.metodo));
            let valorCashback = 0;

            if (clienteId && !pagouComCredito) {
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

                const cashbackPercent = 100;
                valorCashback = (totalPago * cashbackPercent) / 100;

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

            // --- SYNC TO ECOMMERCE ---
            // Fire and forget (or await if critical, but don't block response too much)
            try {
                const ecommerceProvider = require('../integration/ecommerce.provider');
                const { Marca, Categoria, FotoPeca, Cor, Tamanho } = require('../../models');

                for (const item of itens) {
                    const peca = await Peca.findByPk(item.pecaId, {
                        include: [
                            { model: Marca, as: 'marca' },
                            { model: Categoria, as: 'categoria' },
                            { model: FotoPeca, as: 'fotos' },
                            { model: Cor, as: 'cor' },
                            { model: Tamanho, as: 'tamanho' }
                        ]
                    });

                    if (peca && peca.sku_ecommerce) {
                        await ecommerceProvider.updateProduct(peca.sku_ecommerce, peca);
                    }
                }
            } catch (syncErr) {
                console.error('[VendasService] Failed to sync sales to Ecommerce:', syncErr.message);
            }
            // -------------------------

            // --- NOTIFICATION TRIGGER (Dynamic) ---
            // Removed as per request (Post-Sale bot should not exist)
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

        // Map frontend filter values to valid ENUM values
        if (filters.status && filters.status !== 'all') {
            const statusMap = {
                'aberta': 'ABERTA',
                'fechada': 'FECHADA_VIRAR_PEDIDO',
                'cancelada': 'CANCELADA',
                // These don't exist in the current ENUM, return empty if used
                'pronta': null,
                'enviada': null
            };
            const mappedStatus = statusMap[filters.status.toLowerCase()];
            if (mappedStatus) {
                where.status = mappedStatus;
            } else if (filters.status.toLowerCase() !== 'pronta' && filters.status.toLowerCase() !== 'enviada') {
                // If not a known status to skip, try uppercase
                where.status = filters.status.toUpperCase();
            }
            // If pronta or enviada, just don't filter by status (show all) since ENUM doesn't have them
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
                { model: Peca, as: 'itens' }
            ],
            order: [['createdAt', 'DESC']]
        });
    }

    async getItensVendidos(search) {
        const wherePeca = { status: 'VENDIDA' };

        if (search) {
            wherePeca[Op.or] = [
                { codigo_etiqueta: { [Op.like]: `%${search}%` } },
                { descricao_curta: { [Op.like]: `%${search}%` } }
            ];
        }

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
                    where: wherePeca
                }
            ],
            limit: 50,
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

            const pedido = itemPedido.pedido;
            if (!pedido) throw new Error('Pedido vinculado não encontrado');

            // Update Peca - return to stock
            await peca.update({
                status: 'DISPONIVEL',
                quantidade: (peca.quantidade || 0) + 1
            }, { transaction: t });

            // Create Stock Movement
            await MovimentacaoEstoque.create({
                pecaId,
                userId,
                tipo: 'ENTRADA_DEVOLUCAO',
                quantidade: 1,
                motivo: `Devolução Venda ${pedido.codigo_pedido}`,
                data_movimento: new Date()
            }, { transaction: t });

            // Generate Credit for Client (Refund as Store Credit)
            if (pedido.clienteId) {
                await CreditoLoja.create({
                    clienteId: pedido.clienteId,
                    valor: itemPedido.valor_unitario_final,
                    data_validade: addMonths(new Date(), 6),
                    status: 'ATIVO',
                    codigo_cupom: `DEV-${peca.codigo_etiqueta}-${Date.now()}`
                }, { transaction: t });
            }

            // --- REVERSE SUPPLIER COMMISSION (Consignment Items) ---
            if (peca.tipo_aquisicao === 'CONSIGNACAO' && peca.fornecedorId) {
                // Find the original credit entry
                const creditoOriginal = await ContaCorrentePessoa.findOne({
                    where: {
                        pessoaId: peca.fornecedorId,
                        tipo: 'CREDITO',
                        referencia_origem: peca.id, // pecaId
                        descricao: { [Op.like]: '%Venda peça%' }
                    },
                    order: [['createdAt', 'DESC']],
                    transaction: t
                });

                if (creditoOriginal) {
                    const valorEstorno = parseFloat(creditoOriginal.valor);

                    // Create DEBIT to reverse the commission
                    await ContaCorrentePessoa.create({
                        pessoaId: peca.fornecedorId,
                        tipo: 'DEBITO',
                        valor: valorEstorno,
                        descricao: `Estorno devolução peça ${peca.codigo_etiqueta}`,
                        referencia_origem: peca.id,
                        data_movimento: new Date()
                    }, { transaction: t });

                    console.log(`[DEVOLUCAO] Estornado R$ ${valorEstorno} do fornecedor ID ${peca.fornecedorId}`);
                }
            }
            // ---------------------------------------------------------

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
