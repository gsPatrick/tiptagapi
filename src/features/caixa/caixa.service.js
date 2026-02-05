const { CaixaDiario, MovimentacaoCaixaDiario } = require('../../models');

class CaixaService {
    async abrirCaixa(userId, saldoInicial) {
        // Check if user already has an open cash register
        const aberto = await CaixaDiario.findOne({
            where: { userId, status: 'ABERTO' }
        });

        if (aberto) {
            throw new Error('Usuário já possui um caixa aberto.');
        }

        return await CaixaDiario.create({
            userId,
            saldo_inicial: saldoInicial || 0,
            status: 'ABERTO',
            data_abertura: new Date(),
            total_entradas_dinheiro: 0,
            total_saidas_sangria: 0
        });
    }

    async getCaixaAberto(userId) {
        return await CaixaDiario.findOne({
            where: { userId, status: 'ABERTO' },
            include: ['movimentacoes']
        });
    }

    async realizarSangria(userId, valor, descricao) {
        const caixa = await this.getCaixaAberto(userId);
        if (!caixa) throw new Error('Nenhum caixa aberto para este usuário.');

        // Create movement
        await MovimentacaoCaixaDiario.create({
            caixaDiarioId: caixa.id,
            tipo: 'SANGRIA',
            valor,
            descricao,
            userId,
        });

        // Update total outputs in CaixaDiario
        const totalSangria = parseFloat(caixa.total_saidas_sangria || 0) + parseFloat(valor);
        await caixa.update({ total_saidas_sangria: totalSangria });

        return { message: 'Sangria realizada com sucesso', novoTotalSangria: totalSangria };
    }

    async realizarSuprimento(userId, valor, descricao) {
        const caixa = await this.getCaixaAberto(userId);
        if (!caixa) throw new Error('Nenhum caixa aberto para este usuário.');

        await MovimentacaoCaixaDiario.create({
            caixaDiarioId: caixa.id,
            tipo: 'SUPRIMENTO',
            valor,
            descricao,
            userId,
        });

        // Suprimento adds to available cash (we'll include it in the closing calculation)
        // We don't have a dedicated field, so we'll sum from movements at closing time

        return { message: 'Suprimento realizado com sucesso' };
    }

    async fecharCaixa(userId, saldoFinalInformado) {
        const caixa = await this.getCaixaAberto(userId);
        if (!caixa) throw new Error('Nenhum caixa aberto para este usuário.');

        // Get all movements for this cash register to calculate suprimentos
        const movimentacoes = await MovimentacaoCaixaDiario.findAll({
            where: { caixaDiarioId: caixa.id }
        });

        // Sum suprimentos from movements
        const totalSuprimentos = movimentacoes
            .filter(m => m.tipo === 'SUPRIMENTO')
            .reduce((acc, m) => acc + parseFloat(m.valor || 0), 0);

        // Sum sangrias from movements (more accurate than cached value)
        const totalSangrias = movimentacoes
            .filter(m => m.tipo === 'SANGRIA')
            .reduce((acc, m) => acc + parseFloat(m.valor || 0), 0);

        // Calculate expected balance
        // Saldo Inicial + Vendas em Dinheiro + Suprimentos - Sangrias
        const saldoInicial = parseFloat(caixa.saldo_inicial || 0);
        const entradasDinheiro = parseFloat(caixa.total_entradas_dinheiro || 0);

        const saldoCalculado = saldoInicial + entradasDinheiro + totalSuprimentos - totalSangrias;
        const diferenca = parseFloat(saldoFinalInformado) - saldoCalculado;

        console.log(`[fecharCaixa] Caixa ID ${caixa.id}:`);
        console.log(`  - Saldo Inicial: ${saldoInicial}`);
        console.log(`  - Vendas Dinheiro: ${entradasDinheiro}`);
        console.log(`  - Suprimentos: ${totalSuprimentos}`);
        console.log(`  - Sangrias: ${totalSangrias}`);
        console.log(`  - Saldo Calculado: ${saldoCalculado}`);
        console.log(`  - Saldo Informado: ${saldoFinalInformado}`);
        console.log(`  - Diferença: ${diferenca}`);

        await caixa.update({
            saldo_final_informado: saldoFinalInformado,
            saldo_final_calculado: saldoCalculado,
            diferenca_quebra: diferenca,
            total_saidas_sangria: totalSangrias, // Sync cached value
            status: 'FECHADO',
            data_fechamento: new Date(),
        });

        return {
            id: caixa.id,
            saldoInicial,
            entradasDinheiro,
            totalSuprimentos,
            totalSangrias,
            saldoCalculado,
            saldoInformado: parseFloat(saldoFinalInformado),
            diferenca,
            status: 'FECHADO'
        };
    }
}

module.exports = new CaixaService();
