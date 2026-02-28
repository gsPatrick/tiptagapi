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
        const { clienteId, itens, pagamentos, origemVendaId, canal, sacolinhaId } = data;

        const caixaAberto = await CaixaDiario.findOne({
            where: { userId, status: 'ABERTO' }
        });
        if (!caixaAberto) {
            throw new Error('Caixa fechado. Abra o caixa antes de realizar vendas.');
        }

        const t = await sequelize.transaction();

        try {
            // 1. Calculate Totals and Discount Factor
            let totalPago = 0;
            for (const pag of pagamentos) {
                totalPago += parseFloat(pag.valor);
            }

            // Fetch all items first to calculate original subtotal
            const pecasMap = new Map();
            let valorTotalOriginal = 0;

            for (const item of itens) {
                const peca = await Peca.findByPk(item.pecaId, { transaction: t });
                if (!peca || !['DISPONIVEL', 'A_VENDA', 'RESERVADA_SACOLINHA', 'RESERVADA_ECOMMERCE'].includes(peca.status)) {
                    throw new Error(`Peça ${item.pecaId} indisponível`);
                }
                pecasMap.set(item.pecaId, peca);

                // Prioritize price sent from PDV (which may include manual edits)
                const precoReferencia = item.valor_unitario_venda || peca.preco_venda_sacolinha || peca.preco_venda;
                valorTotalOriginal += parseFloat(precoReferencia);
            }

            // Calculate Discount Factor (Cap at 1.0)
            // If totalPago >= valorTotalOriginal, factor is 1 (no discount or tip).
            // If totalPago < valorTotalOriginal, factor < 1.
            let fatorDesconto = 1;
            if (valorTotalOriginal > 0) {
                fatorDesconto = totalPago / valorTotalOriginal;
                if (fatorDesconto > 1) fatorDesconto = 1;
            }

            const pedido = await Pedido.create({
                codigo_pedido: `PDV-${Date.now()}`,
                clienteId,
                vendedorId: userId,
                origem: 'PDV',
                status: 'PAGO',
                data_pedido: new Date(),
            }, { transaction: t });

            let subtotalReal = 0; // Will match totalPago if discounted
            const itensResumo = [];

            for (const item of itens) {
                const peca = pecasMap.get(item.pecaId); // Already fetched

                // Base price for this transaction - prioritize payload price
                const valorOriginal = parseFloat(item.valor_unitario_venda || peca.preco_venda_sacolinha || peca.preco_venda);

                // Apply Discount Factor
                const valorVendaFinal = valorOriginal * fatorDesconto;

                subtotalReal += valorVendaFinal;
                itensResumo.push({ nome: peca.descricao_curta, valor: valorVendaFinal });

                // Decrement Stock Logic
                const novaQuantidade = peca.quantidade - 1;
                const updateData = {
                    quantidade: novaQuantidade,
                    sacolinhaId: sacolinhaId || peca.sacolinhaId, // Ensure association is saved/preserved
                    valor_venda_final: valorVendaFinal // PERSIST SOLD PRICE
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

                // Sync to Ecommerce (add to queue logic omitted, kept original try/catch structure inside loop earlier but here removed/deferred?)
                // Just keep original loop structure? I removed the try/catch loop for sync... 
                // Ah, the sync loop was separate or inside? Inside.
                // I should keep it inside or rely on the POST-COMMIT sync loop I saw earlier.
                // The code I checked earlier had the sync logic AFTER commit. 
                // Wait, in my previous view_file lines 69-84 had a try/catch for real-time sync but logic was "I'll add it to post-commit".
                // In logical flow, the sync should be after commit. 
                // I will add the necessary data to a list if needed, or rely on the implementation at the end of the function (lines 269+ in original).

                await ItemPedido.create({
                    pedidoId: pedido.id,
                    pecaId: peca.id,
                    valor_unitario: valorOriginal, // Store original price
                    valor_unitario_final: valorVendaFinal, // Store discounted price
                }, { transaction: t });

                if (peca.tipo_aquisicao === 'CONSIGNACAO' && peca.fornecedorId) {
                    // FORCED RULE: Consignment is always 50%
                    const comissaoPercent = 50;
                    const valorCredito = (valorVendaFinal * comissaoPercent) / 100;

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

            // Process Payments
            for (const pag of pagamentos) {
                await PagamentoPedido.create({
                    pedidoId: pedido.id,
                    metodo: pag.metodo,
                    valor: pag.valor,
                    parcelas: pag.parcelas || 1,
                }, { transaction: t });

                // totalPago already calculated.

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

                    const creditosDisponiveis = await CreditoLoja.findAll({
                        where: {
                            clienteId,
                            status: 'ATIVO',
                            valor: { [Op.gt]: 0 },
                            data_validade: { [Op.gte]: new Date() }
                        },
                        order: [['data_validade', 'ASC']],
                        transaction: t
                    });

                    const totalDisponivel = creditosDisponiveis.reduce((acc, c) => acc + parseFloat(c.valor), 0);
                    if (totalDisponivel < parseFloat(pag.valor)) {
                        throw new Error('Saldo de permuta insuficiente ou expirado.');
                    }

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

                if (clienteId && !['CREDITO_LOJA', 'VOUCHER_PERMUTA'].includes(pag.metodo)) {
                    const { MovimentacaoConta } = require('../../models');
                    await MovimentacaoConta.create({
                        pessoaId: clienteId,
                        tipo_transacao: 'CREDITO',
                        valor: pag.valor,
                        data_movimento: new Date(),
                        descricao: `Venda PDV ${pedido.codigo_pedido} - ${pag.metodo}`,
                        categoria: 'VENDA_PECA',
                        referencia_origem: pedido.id
                    }, { transaction: t });
                }
            }

            await pedido.update({
                subtotal: valorTotalOriginal, // Catalog price sum
                desconto: Math.max(0, valorTotalOriginal - totalPago), // Total applied discount
                total: totalPago, // Final paid amount
            }, { transaction: t });

            // ----------------------

            if (sacolinhaId) {
                // Keep sacolinha open as per user request to allow adding more items later
                console.log(`Sale linked to sacolinha ${sacolinhaId}. Keeping it open.`);
            }

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
            try {
                if (clienteId) {
                    const cliente = await Pessoa.findByPk(clienteId);
                    if (cliente && cliente.telefone_whatsapp) {

                        const listaProdutos = itensResumo.map(i => `👗 ${i.nome} - R$ ${parseFloat(i.valor).toFixed(2)}`).join('\n');
                        const mensagemBonita = `Olá ${cliente.nome}! 💖\nQue alegria ter você por aqui!\n\nAqui está o resumo das suas comprinhas:\n${listaProdutos}\n\n💰 Total: R$ ${totalPago.toFixed(2)}\n\nObrigado por garimpar com a gente! ♻️`;

                        /*
                        await automacaoService.agendarMensagem({
                            telefone: cliente.telefone_whatsapp,
                            canal: 'WHATSAPP',
                            gatilho: 'POS_VENDA',
                            variaveis: {
                                NOME_CLIENTE: cliente.nome,
                                CODIGO_PEDIDO: pedido.codigo_pedido,
                                VALOR_TOTAL: totalPago.toFixed(2)
                            },
                            // Fallback message if template not found (using our new beautiful format)
                            // mensagem: mensagemBonita
                        });
                        */
                        console.log('Notificação de pós-venda desativada conforme solicitação.');
                    }
                }
            } catch (msgErr) {
                console.error("Erro ao agendar mensagem pós-venda:", msgErr);
                // Não falhar a venda se a mensagem der erro
            }
            // -------------------------------------------

            return pedido;

        } catch (err) {
            // Only rollback if transaction has not been finished
            if (!t.finished) {
                await t.rollback();
            }
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



    async fecharSacolinha(sacolinhaId) {
        const sacolinha = await Sacolinha.findByPk(sacolinhaId);
        if (!sacolinha) throw new Error('Sacolinha not found');
        await sacolinha.update({ status: 'FECHADA_VIRAR_PEDIDO' });
        return { message: 'Sacolinha pronta para virar pedido' };
    }

    async getSacolinhas(filters = {}) {
        const where = {};

        if (filters.clienteId) {
            where.clienteId = filters.clienteId;
        }

        // Map frontend filter values to valid ENUM values
        if (filters.status && filters.status !== 'all') {
            const statusMap = {
                'aberta': 'ABERTA',
                'pronta': 'PRONTA',
                'enviada': 'ENVIADA',
                'fechada': 'FECHADA',
                'finalizada': 'FECHADA_VIRAR_PEDIDO',
                'cancelada': 'CANCELADA'
            };
            const mappedStatus = statusMap[filters.status.toLowerCase()] || filters.status.toUpperCase();
            where.status = mappedStatus;
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

    async getSacolinhaById(id) {
        const sacolinha = await Sacolinha.findByPk(id, {
            include: [
                { model: Pessoa, as: 'cliente' },
                {
                    model: Peca,
                    as: 'itens',
                    include: [
                        { model: sequelize.models.Tamanho, as: 'tamanho' },
                        { model: sequelize.models.Cor, as: 'cor' },
                        { model: Pessoa, as: 'fornecedor' }
                    ]
                }
            ]
        });
        if (!sacolinha) throw new Error('Sacolinha não encontrada');
        return sacolinha;
    }

    async atualizarStatusSacolinha(id, novoStatus, codigo_rastreio = null) {
        const t = await sequelize.transaction();
        try {
            const sacolinha = await Sacolinha.findByPk(id, { transaction: t });
            if (!sacolinha) throw new Error('Sacolinha não encontrada');

            const statusValidos = ['ABERTA', 'PRONTA', 'ENVIADA', 'FECHADA', 'FECHADA_VIRAR_PEDIDO', 'CANCELADA'];
            if (!statusValidos.includes(novoStatus)) {
                throw new Error(`Status inválido: ${novoStatus}`);
            }

            // Se estiver cancelando, libera os itens
            if (novoStatus === 'CANCELADA') {
                await this.liberarItensSacolinha(id, t);
            }

            const updateData = { status: novoStatus };
            if (codigo_rastreio !== null) {
                updateData.codigo_rastreio = codigo_rastreio;
            }

            await sacolinha.update(updateData, { transaction: t });
            await t.commit();

            return sacolinha;
        } catch (err) {
            await t.rollback();
            throw err;
        }
    }

    async excluirSacolinha(id) {
        const t = await sequelize.transaction();
        try {
            const sacolinha = await Sacolinha.findByPk(id, { transaction: t });
            if (!sacolinha) throw new Error('Sacolinha não encontrada');

            // Libera itens antes de excluir
            await this.liberarItensSacolinha(id, t);

            // Exclusão física (hard delete) conforme pedido "excluir totalmente"
            await sacolinha.destroy({ transaction: t, force: true });

            await t.commit();
            return { message: 'Sacolinha excluída permanentemente e itens liberados.' };
        } catch (err) {
            await t.rollback();
            throw err;
        }
    }

    /**
     * Helper para liberar itens de uma sacolinha (usado no cancelamento e exclusão)
     */
    async liberarItensSacolinha(sacolinhaId, transaction) {
        const pecas = await Peca.findAll({
            where: { sacolinhaId },
            transaction
        });

        for (const peca of pecas) {
            const isSold = peca.status === 'VENDIDA';

            // Se for peça VENDIDA, apenas removemos o vínculo com a sacolinha
            if (isSold) {
                await peca.update({ sacolinhaId: null }, { transaction });
                continue;
            }

            const suffix = `-S${sacolinhaId}`;
            // Se a peça tem o sufixo de sacolinha, tenta devolver ao lote original
            if (peca.codigo_etiqueta && peca.codigo_etiqueta.endsWith(suffix)) {
                const originalTag = peca.codigo_etiqueta.replace(suffix, '');
                const pecaPai = await Peca.findOne({
                    where: {
                        codigo_etiqueta: originalTag,
                        status: { [Op.not]: 'VENDIDA' }
                    },
                    transaction
                });

                if (pecaPai) {
                    await pecaPai.update({ quantidade: pecaPai.quantidade + peca.quantidade }, { transaction });
                    await peca.destroy({ transaction, force: true });
                } else {
                    // Fallback se não achar o pai
                    await peca.update({ sacolinhaId: null, status: 'DISPONIVEL' }, { transaction });
                }
            } else {
                // Peça normal, apenas remove a reserva
                await peca.update({
                    sacolinhaId: null,
                    status: 'DISPONIVEL'
                }, { transaction });
            }
        }
    }


    async adicionarItemSacolinha(sacolinhaId, pecaId, preco = null) {
        const sacolinha = await Sacolinha.findByPk(sacolinhaId);
        if (!sacolinha) throw new Error('Sacolinha não encontrada');
        if (sacolinha.status !== 'ABERTA') throw new Error('Só é possível adicionar itens em sacolinhas abertas');

        const peca = await Peca.findByPk(pecaId);
        if (!peca) throw new Error('Peça não encontrada');

        // Se a peça já está reservada para outra sacolinha, não pode adicionar
        if (peca.status === 'RESERVADA_SACOLINHA' && peca.sacolinhaId !== parseInt(sacolinhaId)) {
            throw new Error('Esta peça já está reservada em outra sacolinha');
        }

        if (peca.status === 'VENDIDA') throw new Error('Peça já foi vendida');

        // Use provided price or default to current sale price
        const precoFinal = preco !== null ? preco : peca.preco_venda;

        if (peca.quantidade > 1) {
            // Lógica de desmembramento (Split): Se tem mais de 1, tira 1 do estoque e cria um registro para a sacolinha
            await peca.update({ quantidade: peca.quantidade - 1 });

            const plainPeca = peca.get({ plain: true });
            delete plainPeca.id;
            delete plainPeca.uuid;
            delete plainPeca.createdAt;
            delete plainPeca.updatedAt;

            const novaUnidadeData = {
                ...plainPeca,
                quantidade: 1,
                quantidade_inicial: 1,
                status: 'RESERVADA_SACOLINHA',
                sacolinhaId: sacolinhaId,
                preco_venda_sacolinha: precoFinal
            };

            // Ajusta o código de etiqueta para evitar erro de UNIQUE no banco
            if (novaUnidadeData.codigo_etiqueta) {
                novaUnidadeData.codigo_etiqueta = `${novaUnidadeData.codigo_etiqueta}-S${sacolinhaId}`;
            }

            const novaUnidade = await Peca.create(novaUnidadeData);
            return { message: 'Unidade adicionada à sacolinha', peca: novaUnidade };
        } else {
            // Lógica padrão: apenas muda o status e associa
            await peca.update({
                sacolinhaId: sacolinhaId,
                status: 'RESERVADA_SACOLINHA',
                preco_venda_sacolinha: precoFinal
            });

            return { message: 'Peça adicionada à sacolinha', peca };
        }
    }

    async atualizarPrecoItemSacolinha(sacolinhaId, pecaId, novoPreco) {
        const sacolinha = await Sacolinha.findByPk(sacolinhaId);
        if (!sacolinha) throw new Error('Sacolinha não encontrada');
        if (sacolinha.status !== 'ABERTA') throw new Error('Só é possível alterar preços em sacolinhas abertas');

        const peca = await Peca.findByPk(pecaId);
        if (!peca) throw new Error('Peça não encontrada');
        if (peca.sacolinhaId !== parseInt(sacolinhaId)) throw new Error('Peça não pertence a esta sacolinha');

        await peca.update({ preco_venda_sacolinha: novoPreco });
        return { message: 'Preço atualizado com sucesso', peca };
    }

    async removerItemSacolinha(sacolinhaId, pecaId) {
        const sacolinha = await Sacolinha.findByPk(sacolinhaId);
        if (!sacolinha) throw new Error('Sacolinha não encontrada');
        if (sacolinha.status !== 'ABERTA') throw new Error('Só é possível remover itens de sacolinhas abertas');

        const peca = await Peca.findByPk(pecaId);
        if (!peca) throw new Error('Peça não encontrada');
        if (peca.sacolinhaId !== parseInt(sacolinhaId)) throw new Error('Peça não pertence a esta sacolinha');

        // Lógica de Re-unificação (Merge Back):
        // Se a peça tem o sufixo -S{id}, tentamos devolver a quantidade para a peça original
        const suffix = `-S${sacolinhaId}`;
        if (peca.codigo_etiqueta && peca.codigo_etiqueta.endsWith(suffix)) {
            const originalTag = peca.codigo_etiqueta.replace(suffix, '');
            const pecaPai = await Peca.findOne({
                where: {
                    codigo_etiqueta: originalTag,
                    status: { [Op.not]: 'VENDIDA' } // Tenta achar o lote original ainda ativo
                }
            });

            if (pecaPai) {
                await pecaPai.update({ quantidade: pecaPai.quantidade + peca.quantidade });
                await peca.destroy(); // Remove a unidade desmembrada
                return { message: 'Item devolvido ao lote original e removido da sacolinha' };
            }
        }

        // Caso padrão (não era split ou não achou o pai): Apenas libera a peça
        await peca.update({
            sacolinhaId: null,
            status: 'DISPONIVEL'
        });

        return { message: 'Peça removida da sacolinha e marcada como disponível' };
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

            // Generate Credit (Refund as Store Credit) - ONLY FOR SUPPLIERS
            if (pedido.clienteId) {
                const cliente = await Pessoa.findByPk(pedido.clienteId, { transaction: t });
                if (cliente && cliente.is_fornecedor) {
                    await ContaCorrentePessoa.create({
                        pessoaId: pedido.clienteId,
                        tipo: 'CREDITO',
                        valor: itemPedido.valor_unitario_final,
                        descricao: `Crédito devolução peça ${peca.codigo_etiqueta}`,
                        referencia_origem: peca.id,
                        data_movimento: new Date()
                    }, { transaction: t });
                }
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
    async cancelarVenda(pedidoId) {
        const t = await sequelize.transaction();
        try {
            const pedido = await Pedido.findByPk(pedidoId, {
                include: [
                    { model: ItemPedido, as: 'itens', include: [{ model: Peca, as: 'peca' }] },
                    { model: PagamentoPedido, as: 'pagamentos' }
                ],
                transaction: t
            });
            if (!pedido) throw new Error('Pedido não encontrado');

            // 1. Restore all pieces to DISPONIVEL
            for (const item of pedido.itens) {
                if (item.peca) {
                    await item.peca.update({
                        status: 'DISPONIVEL',
                        data_venda: null,
                        quantidade: 1
                    }, { transaction: t });

                    // Reverse supplier commission if consignment
                    if (item.peca.tipo_aquisicao === 'CONSIGNACAO' && item.peca.fornecedorId) {
                        const creditoOriginal = await ContaCorrentePessoa.findOne({
                            where: {
                                pessoaId: item.peca.fornecedorId,
                                tipo: 'CREDITO',
                                referencia_origem: item.peca.id,
                                descricao: { [Op.like]: '%Venda peça%' }
                            },
                            order: [['createdAt', 'DESC']],
                            transaction: t
                        });
                        if (creditoOriginal) {
                            await ContaCorrentePessoa.create({
                                pessoaId: item.peca.fornecedorId,
                                tipo: 'DEBITO',
                                valor: parseFloat(creditoOriginal.valor),
                                descricao: `Cancelamento venda ${pedido.codigo_pedido} - peça ${item.peca.codigo_etiqueta}`,
                                referencia_origem: item.peca.id,
                                data_movimento: new Date()
                            }, { transaction: t });
                        }
                    }
                }
            }

            // 2. Delete payments
            await PagamentoPedido.destroy({ where: { pedidoId }, transaction: t, force: true });

            // 3. Delete financial movements
            await ContaCorrentePessoa.destroy({ where: { referencia_origem: pedidoId, descricao: { [Op.like]: `%${pedido.codigo_pedido}%` } }, transaction: t, force: true });

            // 4. Delete order items
            await ItemPedido.destroy({ where: { pedidoId }, transaction: t, force: true });

            // 5. Delete the order
            await Pedido.destroy({ where: { id: pedidoId }, transaction: t, force: true });

            await t.commit();
            return { message: `Venda ${pedido.codigo_pedido} cancelada com sucesso` };
        } catch (err) {
            await t.rollback();
            throw err;
        }
    }
}

module.exports = new VendasService();
