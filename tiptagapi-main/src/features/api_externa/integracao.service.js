const { Peca, Pedido, ItemPedido, MovimentacaoEstoque, ContaCorrentePessoa, Pessoa, sequelize } = require('../../models');
const { Op } = require('sequelize');

class IntegracaoService {
    async checkEstoque(sku) {
        // SKU can be sku_ecommerce or codigo_etiqueta
        const peca = await Peca.findOne({
            where: {
                [Op.or]: [
                    { sku_ecommerce: sku },
                    { codigo_etiqueta: sku }
                ]
            }
        });

        if (!peca) {
            return { disponivel: false, message: 'Peça não encontrada' };
        }

        // Check availability
        // Only 'DISPONIVEL' or 'A_VENDA' is true.
        // 'RESERVADA_SACOLINHA' or 'VENDIDA' is false.
        const disponivel = ['DISPONIVEL', 'A_VENDA'].includes(peca.status);

        return {
            disponivel,
            preco: peca.preco_venda,
            estoque: disponivel ? 1 : 0,
            sku: peca.sku_ecommerce || peca.codigo_etiqueta
        };
    }

    async processarWebhookPedido(pedidoData) {
        // pedidoData: { id_externo, itens: [{ sku, valor }], cliente: { ... }, ... }
        const { id_externo, itens, cliente } = pedidoData;

        const t = await sequelize.transaction();

        try {
            // 1. Verify Availability
            const pecasParaVenda = [];
            for (const item of itens) {
                const peca = await Peca.findOne({
                    where: {
                        [Op.or]: [
                            { sku_ecommerce: item.sku },
                            { codigo_etiqueta: item.sku }
                        ]
                    },
                    transaction: t
                });

                if (!peca) {
                    throw new Error(`Peça SKU ${item.sku} não encontrada`);
                }

                if (!['DISPONIVEL', 'A_VENDA'].includes(peca.status)) {
                    // Conflict!
                    throw new Error(`Peça SKU ${item.sku} indisponível (Status: ${peca.status})`);
                }

                pecasParaVenda.push({ peca, valor: item.valor });
            }

            // 2. Create Order
            // Find or create client (simplified)
            let clienteDb = null;
            if (cliente && cliente.cpf) {
                clienteDb = await Pessoa.findOne({ where: { cpf_cnpj: cliente.cpf }, transaction: t });
                if (!clienteDb) {
                    // Create minimal client
                    clienteDb = await Pessoa.create({
                        nome: cliente.nome,
                        cpf_cnpj: cliente.cpf,
                        email: cliente.email,
                        tipo: 'PF',
                        is_cliente: true
                    }, { transaction: t });
                }
            }

            const pedido = await Pedido.create({
                codigo_pedido: `ECOMM-${id_externo}`,
                origem: 'ECOMMERCE',
                status: 'PAGO', // Webhook usually comes after payment
                clienteId: clienteDb ? clienteDb.id : null,
                data_pedido: new Date(),
                total: pecasParaVenda.reduce((acc, p) => acc + parseFloat(p.valor), 0)
            }, { transaction: t });

            // 3. Update Stock & Create Items
            for (const { peca, valor } of pecasParaVenda) {
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

                await peca.update(updateData, {
                    transaction: t,
                    skipOutbound: true // Prevent infinite loop
                });

                await ItemPedido.create({
                    pedidoId: pedido.id,
                    pecaId: peca.id,
                    valor_unitario_final: valor
                }, { transaction: t });

                await MovimentacaoEstoque.create({
                    pecaId: peca.id,
                    tipo: 'SAIDA_VENDA',
                    quantidade: -1,
                    motivo: `Venda E-commerce ${pedido.codigo_pedido}`,
                    data_movimento: new Date()
                }, { transaction: t });

                // 4. Consignment Credit
                if (peca.tipo_aquisicao === 'CONSIGNACAO' && peca.fornecedorId) {
                    const fornecedor = await Pessoa.findByPk(peca.fornecedorId, { transaction: t });
                    const comissaoPercent = fornecedor.comissao_padrao || 50;
                    const valorCredito = (parseFloat(valor) * comissaoPercent) / 100;

                    await ContaCorrentePessoa.create({
                        pessoaId: peca.fornecedorId,
                        tipo: 'CREDITO',
                        valor: valorCredito,
                        descricao: `Venda E-commerce peça ${peca.codigo_etiqueta}`,
                        referencia_origem: peca.id,
                        data_movimento: new Date()
                    }, { transaction: t });
                }
            }

            await t.commit();
            return { message: 'Pedido processado com sucesso', pedidoId: pedido.id };

        } catch (err) {
            await t.rollback();
            // If conflict (unavailable), we should return specific error code in controller
            if (err.message.includes('indisponível')) {
                err.status = 409;
            }
            throw err;
        }
    }
}

module.exports = new IntegracaoService();
