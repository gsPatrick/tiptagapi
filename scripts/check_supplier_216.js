const { ContaCorrentePessoa, Peca, Pessoa } = require('../src/models');
const { sequelize } = require('../src/models');

async function checkSupplier() {
    try {
        const supplierId = 216;
        const supplier = await Pessoa.findByPk(supplierId);
        console.log(`Supplier: ${supplier.nome} (ID: ${supplier.id})`);

        const credits = await ContaCorrentePessoa.findAll({
            where: { pessoaId: supplierId },
            order: [['createdAt', 'DESC']]
        });

        console.log(`\nTotal Records: ${credits.length}`);

        let totalCalculated = 0;
        credits.forEach(c => {
            const valor = parseFloat(c.valor);
            console.log(`[${c.id}] ${c.tipo} - R$ ${valor.toFixed(2)} - ${c.descricao} - ${c.data_movimento}`);
            if (c.tipo === 'CREDITO') totalCalculated += valor;
            if (c.tipo === 'DEBITO') totalCalculated -= valor;
        });

        // Check CreditoLoja
        const { CreditoLoja } = require('../src/models');
        const creditosLoja = await CreditoLoja.findAll({
            where: { clienteId: supplierId },
            order: [['createdAt', 'DESC']]
        });

        console.log(`\n--- Credito Loja ---`);
        creditosLoja.forEach(c => {
            console.log(`[${c.id}] R$ ${c.valor} - Status: ${c.status} - Code: ${c.codigo_cupom}`);
            if (c.status === 'ATIVO') totalCalculated += parseFloat(c.valor);
        });

        console.log(`\nTotal Calculated (ContaCorrente + CreditoLoja): R$ ${totalCalculated.toFixed(2)}`);

        // Check the specific items mentioned
        const items = await Peca.findAll({
            where: {
                codigo_etiqueta: ['TAG-7961', 'TAG-7963']
            }
        });

        console.log('\n--- Specific Items ---');
        items.forEach(i => {
            console.log(`ID: ${i.id}, Tag: ${i.codigo_etiqueta}, Status: ${i.status}, Price: ${i.preco_venda}, Supplier: ${i.fornecedorId}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
    }
}

checkSupplier();
