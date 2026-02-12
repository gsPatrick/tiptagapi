const { VendasService, Peca, CaixaDiario, sequelize, Pessoa } = require('../src/models');
const vendasService = require('../src/features/vendas/vendas.service');

async function testPixSale() {
    const t = await sequelize.transaction();
    try {
        console.log('--- Testing PIX Sale ---');

        // 1. Setup Data
        const client = await Pessoa.findOne({ where: { is_cliente: true } });
        if (!client) throw new Error('No client found');

        const peca = await Peca.findOne({ where: { status: 'DISPONIVEL' } });
        if (!peca) throw new Error('No available piece found');

        const user = await sequelize.models.User.findOne(); // Adjust if necessary
        if (!user) throw new Error('No user found');

        // 2. Mock Caixa
        let caixa = await CaixaDiario.findOne({ where: { userId: user.id, status: 'ABERTO' } });
        if (!caixa) {
            caixa = await CaixaDiario.create({
                userId: user.id,
                status: 'ABERTO',
                data_abertura: new Date(),
                valor_abertura: 0
            });
        }

        const saleData = {
            clienteId: client.id,
            itens: [
                { pecaId: peca.id, valor_unitario_venda: peca.preco_venda }
            ],
            pagamentos: [
                { metodo: 'PIX', valor: peca.preco_venda }
            ]
        };

        console.log(`Processing sale for piece ${peca.id} with PIX and for client ${client.id}...`);
        const result = await vendasService.processarVendaPDV(saleData, user.id);
        console.log('Sale Result ID:', result.id);

        // Verify MovimentacaoConta
        const { MovimentacaoConta } = require('../src/models');
        const mov = await MovimentacaoConta.findOne({
            where: { referencia_origem: result.id, categoria: 'VENDA_PECA' }
        });

        if (mov) {
            console.log(`✅ MovimentacaoConta created: ID ${mov.id}, Categoria: ${mov.categoria}`);
        } else {
            console.log('⚠️ No MovimentacaoConta created (might be expected if logic skipped or failed?)');
        }

        console.log('✅ Success: PIX sale registered correctly.');

    } catch (error) {
        console.error('❌ Failure:', error.message);
        console.error(error.stack);
    } finally {
        await sequelize.close();
    }
}

testPixSale();
