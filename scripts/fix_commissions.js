const {
    sequelize, Pedido, ItemPedido, Peca, ContaCorrentePessoa, Pessoa
} = require('../src/models');
const { Op } = require('sequelize');

async function fixCommissions() {
    const t = await sequelize.transaction();
    try {
        console.log("Starting Commission Fix Script...");

        // 1. Find all CREDIT transactions related to Sales (Consignment)
        const credits = await ContaCorrentePessoa.findAll({
            where: {
                tipo: 'CREDITO',
                descricao: { [Op.like]: 'Venda peça%' },
                referencia_origem: { [Op.ne]: null } // pecaId
            },
            include: [
                { model: Pessoa, as: 'pessoa' } // Fornecedor
            ],
            transaction: t
        });

        console.log(`Found ${credits.length} credit entries to check.`);
        let updatedCount = 0;

        for (const credit of credits) {
            const pecaId = credit.referencia_origem;
            const fornecedorId = credit.pessoaId;

            // 2. Get the Peca to confirm it IS consignment
            const peca = await Peca.findByPk(pecaId, { transaction: t });
            if (!peca || peca.tipo_aquisicao !== 'CONSIGNACAO') {
                continue; // Skip owned items or permut/other
            }

            // 3. Find the Sale (ItemPedido -> Pedido)
            const itemPedido = await ItemPedido.findOne({
                where: { pecaId },
                order: [['createdAt', 'DESC']],
                include: [{ model: Pedido, as: 'pedido' }],
                transaction: t
            });

            if (!itemPedido || !itemPedido.pedido) {
                // console.warn(`[WARN] No sale found for Credit ID ${credit.id}`);
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

            const netPrice = grossPrice * ratio;

            // 5. Calculate Correct Commission (Strict 50%)
            const correctCommission = (netPrice * 50) / 100;

            // 6. Compare with Current Credit
            const currentCredit = parseFloat(credit.valor);
            const diff = Math.abs(currentCredit - correctCommission);

            // Tolerance 0.02 (rounding)
            if (diff > 0.02) {
                console.log(`[FIX] Credit ID ${credit.id} (Peca ${peca.codigo_etiqueta}):`);
                console.log(`   - Order: ${pedido.codigo_pedido} | Gross: ${grossPrice} | Ratio: ${ratio.toFixed(2)} | Net: ${netPrice.toFixed(2)}`);
                console.log(`   - Current Credit: ${currentCredit} (approx ${(currentCredit / grossPrice * 100).toFixed(0)}%)`);
                console.log(`   - New Credit:     ${correctCommission.toFixed(2)} (50%)`);

                // A. Update Credit
                await credit.update({
                    valor: correctCommission
                }, { transaction: t });

                // B. Update Peca Fields (For Report Consistency)
                const valorComissaoLoja = netPrice - correctCommission;
                await peca.update({
                    valor_liquido_fornecedor: correctCommission,
                    valor_comissao_loja: valorComissaoLoja
                }, { transaction: t });

                updatedCount++;
            } else {
                // Check if Peca fields are consistent even if Credit is OK
                // This fixes the dashboard issue
                const currentLiq = parseFloat(peca.valor_liquido_fornecedor || 0);
                if (Math.abs(currentLiq - correctCommission) > 0.02) {
                    const valorComissaoLoja = netPrice - correctCommission;
                    await peca.update({
                        valor_liquido_fornecedor: correctCommission,
                        valor_comissao_loja: valorComissaoLoja
                    }, { transaction: t });
                    console.log(`[FIX] Peca ${peca.codigo_etiqueta} fields updated (Credit was OK).`);
                    updatedCount++;
                }
            }
        }

        await t.commit();
        console.log(`SUCCESS. Updated ${updatedCount} commission records.`);

        // --- VALIDATION FOR USER 106 (Aline) ---
        // Let's print her total balance
        const alineCredits = await ContaCorrentePessoa.sum('valor', {
            where: {
                pessoaId: 106,
                tipo: 'CREDITO'
            }
        }) || 0;
        const alineDebits = await ContaCorrentePessoa.sum('valor', {
            where: {
                pessoaId: 106,
                tipo: 'DEBITO'
            }
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
