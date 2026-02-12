require('dotenv').config();
const { startOfDay, endOfDay } = require('date-fns');
const RelatoriosService = require('../src/features/relatorios/RelatoriosService');
const { Sequelize, Pedido, ItemPedido, Peca, Pessoa, ContaCorrentePessoa } = require('../src/models');

async function verify() {
    try {
        console.log(`--- Verifying RelatoriosService Fix (DB Host: ${process.env.DB_HOST}) ---`);

        // 0. Check Order #7058
        console.log('\n0. Checking for Order #7058...');
        // The user said "Pedido 7058", assuming it's the ID or codigo_pedido. 
        // Let's check both.
        const order7058_id = await Pedido.findByPk(7058);
        const order7058_code = await Pedido.findOne({ where: { codigo_pedido: '7058' } }); // Adjust if format is different like PDV-

        if (order7058_id) console.log('Found Order by ID 7058:', order7058_id.toJSON());
        else console.log('Order ID 7058 not found.');

        if (order7058_code) console.log('Found Order by Code 7058:', order7058_code.toJSON());
        else console.log('Order Code 7058 not found.');

        // Test getVendasPorFornecedor (All Time)
        console.log('\n1. Testing getVendasPorFornecedor (All Time)...');
        const vendasFornecedor = await RelatoriosService.getVendasPorFornecedor(null, null);

        console.log(`Found ${vendasFornecedor.length} suppliers with sales.`);

        if (vendasFornecedor.length > 0) {
            const sample = vendasFornecedor[0];
            console.log('Sample Supplier Report:', sample);

            // Verification check
            const valor = parseFloat(sample.valor);
            const loja = parseFloat(sample.loja);
            const custo = parseFloat(sample.custo);

            const expected = valor * 0.5;

            console.log(`Valor Total: ${valor}`);
            console.log(`Calculated Loja (50%): ${loja} (Expected: ${expected})`);
            console.log(`Calculated Custo (50%): ${custo} (Expected: ${expected})`);

            if (Math.abs(loja - expected) < 0.01 && Math.abs(custo - expected) < 0.01) {
                console.log('✅ PASSED: 50/50 Split Verified for Supplier Aggregation');
            } else {
                console.log('❌ FAILED: 50/50 Split Mismatch for Supplier Aggregation');
            }
        } else {
            console.log('⚠️ No sales found to verify.');
        }

        // Test getVendasRepasse (All Time)
        console.log('\n2. Testing getVendasRepasse (All Time)...');
        const repasse = await RelatoriosService.getVendasRepasse(null, null);
        const allSales = repasse.vendas;

        console.log(`Found ${allSales.length} individual sales items.`);

        if (allSales.length > 0) {
            const sampleSale = allSales[0];
            console.log('Sample Sale Item:', sampleSale);

            const valor = parseFloat(sampleSale.valor);
            const repasseVal = parseFloat(sampleSale.repasse);
            const expected = valor * 0.5;

            console.log(`Item Price: ${valor}`);
            console.log(`Repasse (50%): ${repasseVal} (Expected: ${expected})`);

            if (Math.abs(repasseVal - expected) < 0.01) {
                console.log('✅ PASSED: 50/50 Split Verified for Individual Sale Repasse');
            } else {
                console.log('❌ FAILED: 50/50 Split Mismatch for Individual Sale Repasse');
            }

        } else {
            console.log('⚠️ No individual sales found to verify.');
        }


        // DEBUG: Check Pedidos table directly
        console.log('\n3. Debugging Pedido Table...');
        const totalPedidos = await Pedido.count();
        console.log(`Total Pedidos in DB: ${totalPedidos}`);

        if (totalPedidos > 0) {
            const lastPedido = await Pedido.findOne({
                order: [['createdAt', 'DESC']],
                attributes: ['id', 'status', 'createdAt', 'total']
            });
            console.log('Most recent Pedido:', lastPedido ? lastPedido.toJSON() : 'None');

            const statuses = await Pedido.findAll({
                attributes: ['status', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
                group: ['status'],
                raw: true
            });
            console.log('Pedido Status Distribution:', statuses);
        }

        console.log('\n4. Debugging Peca Table...');
        const totalPecas = await Peca.count();
        console.log(`Total Pecas in DB: ${totalPecas}`);

        // 5. Check for Orphan Sold Items (VENDIDA but no ItemPedido)
        console.log('\n5. Checking for Orphan Sold Items (Legacy/Imported History)...');

        // Find pieces that are VENDIDA
        const soldPecas = await Peca.findAll({
            where: { status: 'VENDIDA' },
            attributes: ['id', 'codigo_etiqueta', 'fornecedorId', 'data_venda'],
            limit: 10
        });

        console.log(`Checking ${soldPecas.length} sample VENDIDA items...`);

        for (const p of soldPecas) {
            const item = await ItemPedido.findOne({ where: { pecaId: p.id } });
            if (!item) {
                console.log(`⚠️ ORPHAN DETECTED: Peca ${p.id} (${p.codigo_etiqueta}) is VENDIDA but has NO ItemPedido.`);

                // Check if it has financial record at least
                if (p.fornecedorId) {
                    const financial = await ContaCorrentePessoa.findOne({
                        where: { referencia_origem: p.id, tipo: 'CREDITO' }
                    });
                    console.log(`   - Financial Record (ContaCorrente): ${financial ? 'FOUND ✅' : 'MISSING ❌'}`);
                }
            } else {
                console.log(`✅ OK: Peca ${p.id} has ItemPedido ${item.id}`);
            }
        }

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        // Close DB connection if needed, usually process exit handles it
        // process.exit();
    }
}

verify();
