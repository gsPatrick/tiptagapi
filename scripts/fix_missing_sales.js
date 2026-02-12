const { Sequelize } = require('sequelize');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Peca, Pedido, ItemPedido, PagamentoPedido } = require('../src/models'); // Use centralized models export

async function fix() {
    try {
        console.log('Connecting to database...');
        // Models are already initialized by require('../src/models')

        // 1. Find all VENDIDA items
        console.log('Scanning for VENDIDA items...');
        const soldPecas = await Peca.findAll({
            where: { status: 'VENDIDA' }
        });

        console.log(`Found ${soldPecas.length} VENDIDA items.`);

        let countFixed = 0;
        let countSkipped = 0;

        for (const peca of soldPecas) {
            // Check if ItemPedido exists
            const existingItem = await ItemPedido.findOne({ where: { pecaId: peca.id } });

            if (existingItem) {
                countSkipped++;
                continue;
            }

            // Create Pedido
            // Generate unique code
            const uniqueSuffix = Math.floor(Math.random() * 10000);
            const codigo_pedido = `LEGACY-${peca.id}-${uniqueSuffix}`;

            const dataVenda = peca.data_venda || new Date('2025-12-24T12:00:00Z');

            const pedido = await Pedido.create({
                codigo_pedido: codigo_pedido,
                origem: 'PDV', // Assuming store sale
                clienteId: null,
                vendedorId: null, // Sistema
                status: 'PAGO',
                tipo_frete: 'RETIRADA',
                valor_frete: 0,
                subtotal: peca.preco_venda,
                desconto: 0,
                total: peca.preco_venda,
                data_pedido: dataVenda,
                createdAt: dataVenda,
                updatedAt: dataVenda
            });

            // Create ItemPedido
            await ItemPedido.create({
                pedidoId: pedido.id,
                pecaId: peca.id,
                valor_unitario: peca.preco_venda,
                quantidade: 1,
                desconto: 0,
                valor_unitario_final: peca.preco_venda,
                createdAt: dataVenda,
                updatedAt: dataVenda
            });

            // Create PagamentoPedido (assume Cash/Generic)
            await PagamentoPedido.create({
                pedidoId: pedido.id,
                metodo: 'DINHEIRO', // Default fallback
                valor: peca.preco_venda,
                createdAt: dataVenda,
                updatedAt: dataVenda
            });

            countFixed++;
            if (countFixed % 50 === 0) process.stdout.write('.');
        }

        console.log(`\nDone! Fixed: ${countFixed}, Skipped (Already OK): ${countSkipped}`);

    } catch (error) {
        console.error('Fatal Error:', error);
    } finally {
        // Force exit as sequelize connection might hang
        process.exit();
    }
}

fix();
