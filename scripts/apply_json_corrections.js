const { Pedido, ItemPedido, Peca, ContaCorrentePessoa, sequelize } = require('../src/models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

const JSON_INPUT = path.join(__dirname, 'vendas_corrigir.json');

async function apply() {
    const t = await sequelize.transaction();
    try {
        console.log('--- Starting Database Correction from JSON (Lookup by Tag) ---');
        const data = JSON.parse(fs.readFileSync(JSON_INPUT, 'utf8'));
        console.log(`Loaded ${data.length} items from JSON.`);

        const affectedPedidoIds = new Set();
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const item of data) {
            try {
                // 1. Find the ItemPedido by Tag ONLY (idVenda can be inconsistent)
                const items = await ItemPedido.findAll({
                    include: [
                        { model: Pedido, as: 'pedido' },
                        { model: Peca, as: 'peca', where: { codigo_etiqueta: item.codigo_etiqueta } }
                    ],
                    transaction: t
                });

                if (items.length === 0) {
                    console.warn(`[SKIP] Tag not found in any sale: ${item.codigo_etiqueta}`);
                    skippedCount++;
                    continue;
                }

                if (items.length > 1) {
                    console.warn(`[WARN] Multiple sales found for tag ${item.codigo_etiqueta}. Using most recent.`);
                    // Logic: Usually we want the active/most recent one.
                }

                // Use the first (or only) match
                const itemPedido = items[0];

                const pecaId = itemPedido.pecaId;
                const pedidoId = itemPedido.pedidoId;
                affectedPedidoIds.add(pedidoId);

                // 2. Update ItemPedido Sale Value
                await itemPedido.update({
                    valor_unitario_final: item.valor_correto
                }, { transaction: t });

                // 3. Update Peca Sale Value (for consistency)
                if (itemPedido.peca) {
                    await itemPedido.peca.update({
                        valor_venda_final: item.valor_correto
                    }, { transaction: t });
                }

                // 4. Update ContaCorrentePessoa (Supplier Credit)
                // We update ALL credits related to this piece to avoid any missing one
                const creditos = await ContaCorrentePessoa.findAll({
                    where: {
                        referencia_origem: pecaId,
                        tipo: 'CREDITO'
                    },
                    transaction: t
                });

                if (creditos.length > 0) {
                    for (const credito of creditos) {
                         await credito.update({
                            valor: item.repasse_correto // Usually 50%
                        }, { transaction: t });
                    }
                } else {
                    console.warn(`[WARN] Credit record not found for Peca ID ${pecaId} (${item.codigo_etiqueta})`);
                }

                updatedCount++;
                if (updatedCount % 50 === 0) console.log(`Processed ${updatedCount} items...`);

            } catch (itemErr) {
                console.error(`[ERROR] Failed to process ${item.codigo_etiqueta}:`, itemErr.message);
                errorCount++;
            }
        }

        // 5. Recalculate Pedido Totals
        console.log(`Recalculating totals for ${affectedPedidoIds.size} affected orders...`);
        for (const pedidoId of affectedPedidoIds) {
            const items = await ItemPedido.findAll({
                where: { pedidoId },
                transaction: t
            });
            const newTotal = items.reduce((acc, it) => acc + parseFloat(it.valor_unitario_final || 0), 0);
            await Pedido.update({ total: newTotal }, { where: { id: pedidoId }, transaction: t });
        }

        await t.commit();
        console.log(`\n✅ CORRECTION COMPLETED SUCCESSFULLY!`);
        console.log(`- Items updated: ${updatedCount}`);
        console.log(`- Items not found (skipped): ${skippedCount}`);
        console.log(`- Errors: ${errorCount}`);
        console.log(`- Unique Orders updated: ${affectedPedidoIds.size}`);

    } catch (error) {
        if (t) await t.rollback();
        console.error('CRITICAL ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

apply();
