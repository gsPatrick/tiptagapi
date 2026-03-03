const { sequelize, ContaCorrentePessoa, Peca } = require('../src/models');
const { Op } = require('sequelize');

async function reverseCredit() {
    const t = await sequelize.transaction();
    try {
        console.log("Buscando crédito da venda TAG-8149 para estornar...");

        // Find the peca
        const peca = await Peca.findOne({
            where: { codigo_etiqueta: 'TAG-8149' }
        });

        if (!peca) {
            console.log("Peça TAG-8149 não encontrada.");
            process.exit(1);
        }

        console.log(`Peça encontrada: ID ${peca.id}, Fornecedor ID: ${peca.fornecedorId}`);

        // Find the original credit
        const creditoOriginal = await ContaCorrentePessoa.findOne({
            where: {
                pessoaId: peca.fornecedorId,
                tipo: 'CREDITO',
                referencia_origem: peca.id,
                descricao: { [Op.like]: '%Venda peça%' }
            },
            order: [['createdAt', 'DESC']],
            transaction: t
        });

        if (!creditoOriginal) {
            console.log("Crédito original não encontrado. Talvez já foi estornado?");
            await t.rollback();
            process.exit(0);
        }

        console.log(`Crédito encontrado: ID ${creditoOriginal.id}, Valor: R$ ${creditoOriginal.valor}`);

        // Check if already reversed
        const jaEstornado = await ContaCorrentePessoa.findOne({
            where: {
                pessoaId: peca.fornecedorId,
                tipo: 'DEBITO',
                referencia_origem: peca.id,
                descricao: { [Op.like]: '%Estorno%' }
            },
            transaction: t
        });

        if (jaEstornado) {
            console.log("Este crédito já foi estornado anteriormente.");
            await t.rollback();
            process.exit(0);
        }

        // Create DEBIT to reverse
        const valorEstorno = parseFloat(creditoOriginal.valor);
        await ContaCorrentePessoa.create({
            pessoaId: peca.fornecedorId,
            tipo: 'DEBITO',
            valor: valorEstorno,
            descricao: `Estorno devolução peça ${peca.codigo_etiqueta}`,
            referencia_origem: peca.id,
            data_movimento: new Date()
        }, { transaction: t });

        await t.commit();
        console.log(`\n✅ ESTORNO REALIZADO: R$ ${valorEstorno} debitado do fornecedor ID ${peca.fornecedorId}`);

        // Print new balance
        const totalCreditos = await ContaCorrentePessoa.sum('valor', {
            where: { pessoaId: peca.fornecedorId, tipo: 'CREDITO' }
        }) || 0;
        const totalDebitos = await ContaCorrentePessoa.sum('valor', {
            where: { pessoaId: peca.fornecedorId, tipo: 'DEBITO' }
        }) || 0;

        console.log(`\n[INFO] Novo Saldo Fornecedor ID ${peca.fornecedorId}: R$ ${(totalCreditos - totalDebitos).toFixed(2)}`);

        process.exit(0);
    } catch (err) {
        await t.rollback();
        console.error("ERRO:", err);
        process.exit(1);
    }
}

reverseCredit();
