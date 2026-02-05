const {
    sequelize, Pedido, ItemPedido, Peca, ContaCorrentePessoa, Pessoa
} = require('../src/models');
const { Op } = require('sequelize');

async function fixCommissions() {
    const t = await sequelize.transaction();
    try {
        console.log("Starting Commission Fix Script...");

        // 1. Find all CREDIT transactions related to Sales (Consignment)
        // We filter by description "Venda peça%" to target sales credits.
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
            // We need the Pedido to see if there was a Discount.
            // We order by createdAt DESC to match the latest sale of this item (in case of re-stock/re-sell, though rare for same ID).
            const itemPedido = await ItemPedido.findOne({
                where: { pecaId },
                order: [['createdAt', 'DESC']],
                include: [{ model: Pedido, as: 'pedido' }],
                transaction: t
            });

            if (!itemPedido || !itemPedido.pedido) {
                console.warn(`[WARN] No sale found for Credit ID ${credit.id} (Peca ${pecaId})`);
                continue;
            }

            const pedido = itemPedido.pedido;

            // 4. Calculate Net Price
            // Current Item Price in DB (Gross usually, unless fixed recently)
            const grossPrice = parseFloat(itemPedido.valor_unitario_final);

            // Calculate Discount Ratio from Order
            const subtotal = parseFloat(pedido.subtotal || pedido.total); // Fallback if subtotal 0
            const total = parseFloat(pedido.total);
            const discountVal = parseFloat(pedido.desconto || 0);

            // Logic: Ratio = Total / (Total + Discount) ?? 
            // Better: Ratio = Total / Subtotal.
            // If Subtotal is 0 or null, assume Ratio 1.
            let ratio = 1;
            if (subtotal > 0) {
                ratio = total / subtotal;
            }
            // If discount exists but subtotal match total? (Frontend bug?). 
            // Let's rely on (Total Paid / Sum of Items).
            // But ItemPedido sum might differ from Pedido Subtotal if freight involved?
            // Safer: NetPrice = grossPrice * ratio.

            // Edge case: ratio > 1? (Interest?). Cap at 1?
            if (ratio > 1) ratio = 1;

            const netPrice = grossPrice * ratio;

            // 5. Calculate Correct Commission (Strict 50%)
            // Rule: 50% of Net Price.
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

                await credit.update({
                    valor: correctCommission
                }, { transaction: t });

                updatedCount++;
            }
        }

        await t.commit();
        console.log(`SUCCESS. Updated ${updatedCount} commission records.`);
        process.exit(0);

    } catch (err) {
        await t.rollback();
        console.error("ERROR running fix script:", err);
        process.exit(1);
    }
}

fixCommissions();
