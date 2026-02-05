const {
    sequelize, Pedido, ItemPedido, Peca, ContaCorrentePessoa, Pessoa
} = require('../src/models');
const { Op } = require('sequelize');

async function fixCommissions() {
    const t = await sequelize.transaction();
    try {
        console.log("Starting Commission Fix Script (v3 - Full Fix)...");

        // 1. Find all CREDIT transactions related to Sales (Consignment)
        const credits = await ContaCorrentePessoa.findAll({
            where: {
                tipo: 'CREDITO',
                descricao: { [Op.like]: 'Venda peça%' },
                referencia_origem: { [Op.ne]: null } // pecaId
            },
            include: [
                { model: Pessoa, as: 'pessoa' }
            ],
            transaction: t
        });

        console.log(`Found ${credits.length} credit entries to check.`);
        let updatedCount = 0;

        for (const credit of credits) {
            const pecaId = credit.referencia_origem;

            // 2. Get the Peca to confirm it IS consignment
            const peca = await Peca.findByPk(pecaId, { transaction: t });
            if (!peca || peca.tipo_aquisicao !== 'CONSIGNACAO') {
                continue;
            }

            // 3. Find the Sale (ItemPedido -> Pedido)
            const itemPedido = await ItemPedido.findOne({
                where: { pecaId },
                order: [['createdAt', 'DESC']],
                include: [{ model: Pedido, as: 'pedido' }],
                transaction: t
            });

            if (!itemPedido || !itemPedido.pedido) {
                continue;
            }

            const pedido = itemPedido.pedido;

            // 4. Calculate Net Price
            const grossPrice = parseFloat(itemPedido.valor_unitario_final);
            const subtotal = parseFloat(pedido.subtotal || pedido.total);
            const total = parseFloat(pedido.total);

            // Ratio of Pay / Subtotal
            let ratio = 1;
            if (subtotal > 0) {
                ratio = total / subtotal;
            }
            if (ratio > 1) ratio = 1;

            const netPrice = parseFloat((grossPrice * ratio).toFixed(2));

            // 5. Calculate Correct Commission (Strict 50%)
            const correctCommission = parseFloat(((netPrice * 50) / 100).toFixed(2));
            const valorComissaoLoja = parseFloat((netPrice - correctCommission).toFixed(2));

            // 6. Compare with Current Credit
            const currentCredit = parseFloat(credit.valor);
            const diff = Math.abs(currentCredit - correctCommission);

            let needsUpdate = false;

            // Check if credit needs update
            if (diff > 0.02) {
                needsUpdate = true;
            }

            // Check if ItemPedido price needs update (IMPORTANT FOR REPORTS)
            const currentItemPrice = parseFloat(itemPedido.valor_unitario_final);
            if (Math.abs(currentItemPrice - netPrice) > 0.02) {
                needsUpdate = true;
            }

            // Check if Peca fields need update
            const currentLiq = parseFloat(peca.valor_liquido_fornecedor || 0);
            if (Math.abs(currentLiq - correctCommission) > 0.02) {
                needsUpdate = true;
            }

            if (needsUpdate) {
                console.log(`[FIX] Peca ${peca.codigo_etiqueta}:`);
                console.log(`   - Order: ${pedido.codigo_pedido}`);
                console.log(`   - Gross Price (Old): ${grossPrice} | Net Price (New): ${netPrice}`);
                console.log(`   - Commission: ${correctCommission} (50%) | Store: ${valorComissaoLoja}`);

                // A. Update Credit (ContaCorrentePessoa)
                if (Math.abs(currentCredit - correctCommission) > 0.02) {
                    await credit.update({
                        valor: correctCommission
                    }, { transaction: t });
                    console.log(`   - Credit Updated: ${currentCredit} -> ${correctCommission}`);
                }

                // B. Update ItemPedido (For Reports - "Vlr Vendido")
                if (Math.abs(currentItemPrice - netPrice) > 0.02) {
                    await itemPedido.update({
                        valor_unitario_final: netPrice
                    }, { transaction: t });
                    console.log(`   - ItemPedido Updated: ${currentItemPrice} -> ${netPrice}`);
                }

                // C. Update Peca Fields (For Report Consistency)
                await peca.update({
                    valor_liquido_fornecedor: correctCommission,
                    valor_comissao_loja: valorComissaoLoja
                }, { transaction: t });
                console.log(`   - Peca fields updated.`);

                updatedCount++;
            }
        }

        await t.commit();
        console.log(`\nSUCCESS. Updated ${updatedCount} records.`);

        // --- VALIDATION FOR USER 106 (Aline) ---
        const alineCredits = await ContaCorrentePessoa.sum('valor', {
            where: { pessoaId: 106, tipo: 'CREDITO' }
        }) || 0;
        const alineDebits = await ContaCorrentePessoa.sum('valor', {
            where: { pessoaId: 106, tipo: 'DEBITO' }
        }) || 0;
        console.log(`[INFO] Saldo Atual Aline Cruz (ID 106): R$ ${(alineCredits - alineDebits).toFixed(2)}`);

        process.exit(0);

    } catch (err) {
        await t.rollback();
        console.error("ERROR running fix script:", err);
        process.exit(1);
    }
}

fixCommissions();
