const { CaixaDiario, MovimentacaoCaixaDiario, Pedido, PagamentoPedido, User, Pessoa } = require('../../models');
const { Op } = require('sequelize');

class CaixaService {
    async abrirCaixa(userId, saldoInicial) {
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

        await MovimentacaoCaixaDiario.create({
            caixaDiarioId: caixa.id,
            tipo: 'SANGRIA',
            valor,
            descricao,
            userId,
        });

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

        return { message: 'Suprimento realizado com sucesso' };
    }

    async fecharCaixa(userId, saldoFinalInformado) {
        const caixa = await this.getCaixaAberto(userId);
        if (!caixa) throw new Error('Nenhum caixa aberto para este usuário.');

        return await this._processarFechamento(caixa, saldoFinalInformado);
    }

    async fecharCaixaById(caixaId, saldoFinalInformado) {
        const caixa = await CaixaDiario.findByPk(caixaId);
        if (!caixa) throw new Error('Caixa não encontrado.');
        if (caixa.status === 'FECHADO') throw new Error('Este caixa já está fechado.');

        return await this._processarFechamento(caixa, saldoFinalInformado);
    }

    async _processarFechamento(caixa, saldoFinalInformado) {
        const movimentacoes = await MovimentacaoCaixaDiario.findAll({
            where: { caixaDiarioId: caixa.id }
        });

        const totalSuprimentos = movimentacoes
            .filter(m => m.tipo === 'SUPRIMENTO')
            .reduce((acc, m) => acc + parseFloat(m.valor || 0), 0);

        const totalSangrias = movimentacoes
            .filter(m => m.tipo === 'SANGRIA')
            .reduce((acc, m) => acc + parseFloat(m.valor || 0), 0);

        const saldoInicial = parseFloat(caixa.saldo_inicial || 0);
        const entradasDinheiro = parseFloat(caixa.total_entradas_dinheiro || 0);

        const saldoCalculado = saldoInicial + entradasDinheiro + totalSuprimentos - totalSangrias;
        const diferenca = parseFloat(saldoFinalInformado || 0) - saldoCalculado;

        console.log(`[fecharCaixa] Caixa ID ${caixa.id}:`);
        console.log(`  - Saldo Inicial: ${saldoInicial}`);
        console.log(`  - Vendas Dinheiro: ${entradasDinheiro}`);
        console.log(`  - Suprimentos: ${totalSuprimentos}`);
        console.log(`  - Sangrias: ${totalSangrias}`);
        console.log(`  - Saldo Calculado: ${saldoCalculado}`);
        console.log(`  - Saldo Informado: ${saldoFinalInformado}`);
        console.log(`  - Diferença: ${diferenca}`);

        await caixa.update({
            saldo_final_informado: saldoFinalInformado || saldoCalculado,
            saldo_final_calculado: saldoCalculado,
            diferenca_quebra: diferenca,
            total_saidas_sangria: totalSangrias,
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
            saldoInformado: parseFloat(saldoFinalInformado || saldoCalculado),
            diferenca,
            status: 'FECHADO'
        };
    }

    // Get all open caixas (for admin view)
    async getTodosCaixasAbertos() {
        const caixas = await CaixaDiario.findAll({
            where: { status: 'ABERTO' },
            include: [{ model: User, as: 'operador', attributes: ['id', 'nome'] }],
            order: [['data_abertura', 'DESC']]
        });

        return caixas.map(c => ({
            id: c.id,
            userId: c.userId,
            usuario: c.operador ? c.operador.nome : 'SISTEMA',
            abertura: new Date(c.data_abertura).toLocaleString('pt-BR'),
            saldoInicial: parseFloat(c.saldo_inicial || 0),
            entradasDinheiro: parseFloat(c.total_entradas_dinheiro || 0),
            sangrias: parseFloat(c.total_saidas_sangria || 0),
            saldoAtual: parseFloat(c.saldo_inicial || 0) + parseFloat(c.total_entradas_dinheiro || 0) - parseFloat(c.total_saidas_sangria || 0)
        }));
    }

    // Get details of a specific caixa including sales
    async getDetalhesCaixa(caixaId) {
        const caixa = await CaixaDiario.findByPk(caixaId, {
            include: [
                { model: User, as: 'operador', attributes: ['id', 'nome'] },
                { model: MovimentacaoCaixaDiario, as: 'movimentacoes' }
            ]
        });

        if (!caixa) throw new Error('Caixa não encontrado.');

        // Get sales made during this caixa's period (all salespeople)
        const vendas = await Pedido.findAll({
            where: {
                data_pedido: { [Op.gte]: caixa.data_abertura },
                status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] }
            },
            include: [
                { model: Pessoa, as: 'cliente', attributes: ['nome'] },
                { model: User, as: 'vendedor', attributes: ['id', 'nome'] },
                { model: PagamentoPedido, as: 'pagamentos' }
            ],
            order: [['data_pedido', 'DESC']]
        });

        // Calculate totals by payment method
        const totais = {
            dinheiro: 0,
            pix: 0,
            credito: 0,
            debito: 0,
            creditoLoja: 0,
            voucherPermuta: 0,
            outros: 0
        };

        vendas.forEach(venda => {
            if (venda.pagamentos) {
                venda.pagamentos.forEach(pag => {
                    const valor = parseFloat(pag.valor || 0);
                    switch (pag.metodo) {
                        case 'DINHEIRO': totais.dinheiro += valor; break;
                        case 'PIX': totais.pix += valor; break;
                        case 'CREDITO': totais.credito += valor; break;
                        case 'DEBITO': totais.debito += valor; break;
                        case 'CREDITO_LOJA': totais.creditoLoja += valor; break;
                        case 'VOUCHER_PERMUTA': totais.voucherPermuta += valor; break;
                        default: totais.outros += valor;
                    }
                });
            }
        });

        const movimentacoes = caixa.movimentacoes || [];
        const totalSuprimentos = movimentacoes
            .filter(m => m.tipo === 'SUPRIMENTO')
            .reduce((acc, m) => acc + parseFloat(m.valor || 0), 0);
        const totalSangrias = movimentacoes
            .filter(m => m.tipo === 'SANGRIA')
            .reduce((acc, m) => acc + parseFloat(m.valor || 0), 0);

        const saldoInicial = parseFloat(caixa.saldo_inicial || 0);
        const saldoCalculado = saldoInicial + totais.dinheiro + totalSuprimentos - totalSangrias;

        return {
            id: caixa.id,
            status: caixa.status,
            usuario: caixa.operador ? caixa.operador.nome : 'SISTEMA',
            abertura: new Date(caixa.data_abertura).toLocaleString('pt-BR'),
            saldoInicial,
            resumo: {
                totalVendas: vendas.length,
                ...totais,
                totalSuprimentos,
                totalSangrias,
                saldoCalculado
            },
            vendas: vendas.map(v => ({
                id: v.id,
                codigo: v.codigo_pedido,
                data: new Date(v.data_pedido).toLocaleString('pt-BR'),
                cliente: v.cliente ? v.cliente.nome : 'CONSUMIDOR FINAL',
                vendedor: v.vendedor ? v.vendedor.nome : 'LOJA',
                total: parseFloat(v.total || 0),
                pagamentos: v.pagamentos ? v.pagamentos.map(p => ({
                    metodo: p.metodo,
                    valor: parseFloat(p.valor)
                })) : []
            })),
            movimentacoes: movimentacoes.map(m => ({
                id: m.id,
                tipo: m.tipo,
                valor: parseFloat(m.valor),
                descricao: m.descricao,
                data: new Date(m.createdAt).toLocaleString('pt-BR')
            }))
        };
    }

    // Auto-close all open caixas (for midnight cron)
    async fecharTodosCaixasAbertos() {
        const caixasAbertos = await CaixaDiario.findAll({
            where: { status: 'ABERTO' }
        });

        const results = [];
        for (const caixa of caixasAbertos) {
            try {
                // Auto-close with calculated balance (no manual input)
                const result = await this._processarFechamento(caixa, null);
                results.push({ id: caixa.id, status: 'fechado', ...result });
                console.log(`[AUTO-CLOSE] Caixa ID ${caixa.id} fechado automaticamente.`);
            } catch (err) {
                results.push({ id: caixa.id, status: 'erro', error: err.message });
                console.error(`[AUTO-CLOSE] Erro ao fechar Caixa ID ${caixa.id}:`, err.message);
            }
        }

        return results;
    }
}

module.exports = new CaixaService();
