const { Peca, Pessoa, CaixaDiario, User, sequelize, Pedido, ItemPedido, ContaCorrentePessoa, PagamentoPedido } = require('../src/models');
const vendasService = require('../src/features/vendas/vendas.service');

async function reproduce() {
    const t = await sequelize.transaction();
    try {
        // 1. Setup Data
        // Find a supplier
        const supplier = await Pessoa.findOne({ where: { is_fornecedor: true } });
        // Find a user/seller
        const user = await User.findOne();
        // Ensure Caixa is open
        let caixa = await CaixaDiario.findOne({ where: { userId: user.id, status: 'ABERTO' } });
        if (!caixa) {
            caixa = await CaixaDiario.create({
                userId: user.id,
                status: 'ABERTO',
                data_abertura: new Date(),
                valor_inicial: 100
            }, { transaction: t });
        }

        // Create a test item with price 2000
        const item = await Peca.create({
            codigo_etiqueta: `TEST-${Date.now()}`,
            descricao_curta: 'PRODUTO TESTE DESCONTO',
            preco_venda: 2000.00,
            preco_custo: 1000.00,
            quantidade: 1,
            status: 'DISPONIVEL',
            tipo_aquisicao: 'CONSIGNACAO',
            fornecedorId: supplier.id,
            marcaId: 1,
            categoriaId: 1
        }, { transaction: t });

        console.log(`Item Created: ${item.codigo_etiqueta}, Price: ${item.preco_venda}`);

        // 2. Process Sale with Discount (Pay 1000 instead of 2000)
        console.log('Processing Sale with 50% Discount (Payment: 1000)...');

        const saleData = {
            clienteId: null,
            itens: [{ pecaId: item.id, valor_unitario_venda: 2000.00 }], // Frontend sends original price usually? Or maybe frontend doesn't send it? Service uses peca.preco_venda fallback.
            pagamentos: [{ metodo: 'DINHEIRO', valor: 1000.00 }], // Paying half
            origemVendaId: null,
            canal: 'PDV',
            sacolinhaId: null
        };

        // We need to commit the item creation first so the service can find it in its own transaction? 
        // Or we can mock the service call? The service creates its own transaction.
        // So we should commit setup data.
        await t.commit();

        const pedido = await vendasService.processarVendaPDV(saleData, user.id);

        // 3. Verify Results
        const itemPedido = await ItemPedido.findOne({ where: { pedidoId: pedido.id } });
        const financial = await ContaCorrentePessoa.findOne({
            where: { referencia_origem: item.id, tipo: 'CREDITO' }
        });

        console.log('\n--- Results ---');
        console.log(`Original Price: 2000.00`);
        console.log(`Paid Amount: 1000.00`);
        console.log(`ItemPedido.valor_unitario_final: ${itemPedido.valor_unitario_final}`);
        console.log(`Commission Credit: ${financial.valor}`);

        const expectedCommission = 1000.00 * 0.5; // 500
        if (parseFloat(financial.valor) === 1000.00) { // 50% of 2000
            console.log(`❌ BUG CONFIRMED: Commission is 1000 (50% of 2000), should be 500 (50% of 1000).`);
        } else if (parseFloat(financial.valor) === 500.00) {
            console.log(`✅ CORRECT: Commission is 500.`);
        } else {
            console.log(`❓ UNEXPECTED: Commission is ${financial.valor}`);
        }

    } catch (error) {
        if (!t.finished) await t.rollback();
        console.error(error);
    } finally {
        await sequelize.close();
    }
}

reproduce();
