const { ContaCorrentePessoa, ContaPagarReceber, Pessoa, CreditoLoja, Repasse, Pedido, PagamentoPedido, FormaPagamento, TipoDeReceitaDespesa } = require('../../models');
const { Op } = require('sequelize');

class FinanceiroService {
    async getExtrato(pessoaId) {
        const movimentos = await ContaCorrentePessoa.findAll({
            where: { pessoaId },
            order: [['data_movimento', 'ASC'], ['id', 'ASC']],
        });

        let saldo = 0;
        const extrato = movimentos.map(mov => {
            const valor = parseFloat(mov.valor);
            if (mov.tipo === 'CREDITO') {
                saldo += valor;
            } else {
                saldo -= valor;
            }
            return {
                ...mov.toJSON(),
                saldo_acumulado: saldo.toFixed(2),
            };
        });

        return extrato;
    }

    async getRepasses() {
        // Find suppliers with positive balance
        // We group by pessoaId and sum (CREDITO - DEBITO)

        const saldos = await ContaCorrentePessoa.findAll({
            attributes: [
                'pessoaId',
                [ContaCorrentePessoa.sequelize.fn('SUM',
                    ContaCorrentePessoa.sequelize.literal(`CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END`)
                ), 'saldo_total']
            ],
            group: ['pessoaId'],
            having: ContaCorrentePessoa.sequelize.literal(`SUM(CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END) > 0`),
            include: [{ model: Pessoa, as: 'pessoa', attributes: ['nome', 'dados_pix', 'email'] }]
        });

        return saldos;
    }

    async pagarRepasse(data) {
        const { pessoaId, valor } = data;

        // 1. Create Debit in Supplier Account (ContaCorrentePessoa)
        await ContaCorrentePessoa.create({
            pessoaId,
            tipo: 'DEBITO',
            valor,
            descricao: 'Pagamento de Repasse',
            data_movimento: new Date(),
        });

        // 2. Create Repasse Record
        await Repasse.create({
            fornecedorId: pessoaId,
            valor_total: valor,
            status: 'PAGO',
            data_pagamento: new Date(),
        });

        // 3. Create Outgoing in Store Cash Flow (ContaPagarReceber) - Optional but good for store financial tracking
        await ContaPagarReceber.create({
            descricao: `Repasse para fornecedor ${pessoaId}`,
            pessoaId,
            tipo: 'PAGAR',
            valor_previsto: valor,
            valor_pago: valor,
            data_vencimento: new Date(),
            data_pagamento: new Date(),
            status: 'PAGO',
        });

        return { message: 'Repasse realizado com sucesso' };
    }

    async checkCreditosExpirados() {
        const today = new Date();
        const creditos = await CreditoLoja.findAll({
            where: {
                status: 'ATIVO',
                data_validade: { [Op.lt]: today },
            }
        });

        for (const cred of creditos) {
            await cred.update({ status: 'EXPIRADO' });
        }
        return { count: creditos.length };
    }
    async getDRE(inicio, fim) {
        const whereDate = {};
        if (inicio && fim) {
            whereDate[Op.between] = [new Date(inicio), new Date(fim)];
        }

        // Receita: Vendas (PAGO, SEPARACAO, ENVIADO, ENTREGUE)
        const vendas = await Pedido.findAll({
            where: {
                status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] },
                data_pedido: whereDate
            },
            attributes: ['subtotal', 'desconto', 'valor_frete', 'total']
        });

        const receitaVendas = vendas.reduce((acc, p) => acc + parseFloat(p.subtotal || 0) - parseFloat(p.desconto || 0), 0);
        const receitaFrete = vendas.reduce((acc, p) => acc + parseFloat(p.valor_frete || 0), 0);
        const receitaTotal = receitaVendas + receitaFrete;

        // Devoluções
        const devolucoes = await Pedido.findAll({
            where: {
                status: 'DEVOLVIDO',
                data_pedido: whereDate
            },
            attributes: ['total']
        });
        const totalDevolucoes = devolucoes.reduce((acc, p) => acc + parseFloat(p.total || 0), 0);

        // Despesas (ContaPagarReceber type PAGAR, status PAGO)
        const despesas = await ContaPagarReceber.findAll({
            where: {
                tipo: 'PAGAR',
                status: 'PAGO',
                data_pagamento: whereDate
            },
            include: [{ model: TipoDeReceitaDespesa, as: 'categoria', attributes: ['nome'] }],
            attributes: ['valor_pago', 'categoriaId']
        });

        const despesasPorCategoria = {};
        let totalDespesas = 0;

        despesas.forEach(d => {
            const catName = d.categoria ? d.categoria.nome : 'Outras Despesas';
            const val = parseFloat(d.valor_pago || 0);
            despesasPorCategoria[catName] = (despesasPorCategoria[catName] || 0) + val;
            totalDespesas += val;
        });

        const lucroLiquido = receitaTotal - totalDevolucoes - totalDespesas;

        return {
            receitaVendas,
            receitaFrete,
            receitaTotal,
            totalDevolucoes,
            totalDespesas,
            despesasPorCategoria,
            lucroLiquido
        };
    }

    async getRecebiveis(inicio, fim) {
        const whereDate = {};
        if (inicio && fim) {
            whereDate[Op.between] = [new Date(inicio), new Date(fim)];
        }

        const pagamentos = await PagamentoPedido.findAll({
            where: {
                createdAt: whereDate
            },
            include: [{ model: Pedido, as: 'pedido', attributes: ['data_pedido', 'codigo_pedido'] }]
        });

        const formas = await FormaPagamento.findAll();

        const receivables = pagamentos.map(p => {
            // Try to match method name
            let rule = formas.find(f =>
                f.nome.toUpperCase().includes(p.metodo) ||
                p.metodo.includes(f.nome.toUpperCase())
            );

            // Fallback for common names
            if (!rule && p.metodo === 'CREDITO') rule = formas.find(f => f.nome.toUpperCase().includes('CRÉDITO'));
            if (!rule && p.metodo === 'DEBITO') rule = formas.find(f => f.nome.toUpperCase().includes('DÉBITO'));

            let taxa = 0;
            let dias = 0;

            if (rule) {
                taxa = parseFloat(rule.taxa_percentual || 0);
                dias = rule.dias_compensacao || 0;
            }

            const valorBruto = parseFloat(p.valor);
            const valorLiquido = valorBruto * (1 - taxa / 100);

            const dataVenda = new Date(p.createdAt);
            const dataPrevisao = new Date(dataVenda);
            dataPrevisao.setDate(dataPrevisao.getDate() + dias);

            return {
                id: p.id,
                pedidoId: p.pedidoId,
                codigo_pedido: p.pedido ? p.pedido.codigo_pedido : 'N/A',
                metodo: p.metodo,
                valor_bruto: valorBruto.toFixed(2),
                taxa_aplicada: taxa,
                dias_compensacao: dias,
                valor_liquido: valorLiquido.toFixed(2),
                data_venda: dataVenda,
                data_previsao: dataPrevisao
            };
        });

        return receivables;
    }

    async createTransacao(data) {
        const { descricao, pessoaId, tipo, valor, data_vencimento, data_pagamento, status, categoriaId } = data;

        const transacao = await ContaPagarReceber.create({
            descricao,
            pessoaId,
            tipo,
            valor_previsto: valor,
            valor_pago: status === 'PAGO' ? valor : null,
            data_vencimento,
            data_pagamento: status === 'PAGO' ? (data_pagamento || new Date()) : null,
            status,
            categoriaId
        });

        return transacao;
    }

    async getTransacoes(inicio, fim, tipo) {
        const whereClause = {};

        if (inicio && fim) {
            whereClause.data_vencimento = { [Op.between]: [new Date(inicio), new Date(fim)] };
        }

        if (tipo && tipo !== 'todos') {
            whereClause.tipo = tipo.toUpperCase(); // RECEITA (RECEBER) or DESPESA (PAGAR)
            // Map frontend 'receita'/'despesa' to model 'RECEBER'/'PAGAR' if needed
            if (tipo === 'receita') whereClause.tipo = 'RECEBER';
            if (tipo === 'despesa') whereClause.tipo = 'PAGAR';
        }

        const transacoes = await ContaPagarReceber.findAll({
            where: whereClause,
            include: [
                { model: TipoDeReceitaDespesa, as: 'categoria', attributes: ['nome'] },
                { model: Pessoa, as: 'pessoa', attributes: ['nome'] }
            ],
            order: [['data_vencimento', 'DESC']]
        });

        return transacoes.map(t => ({
            id: t.id,
            data: new Date(t.data_vencimento).toLocaleDateString('pt-BR'),
            competencia: new Date(t.data_vencimento).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }),
            tipo: t.tipo === 'RECEBER' ? 'Receita' : 'Despesa',
            categoria: t.categoria ? t.categoria.nome : 'Geral',
            desc: t.descricao,
            valor: parseFloat(t.valor_previsto),
            conta: 'Caixa Loja', // Placeholder as model doesn't have account
            doc: 'N/A',
            saldo: 0, // Need to calculate running balance if needed, or just leave 0
            status: t.status === 'PAGO' ? 'Conciliado' : 'Pendente'
        }));
    }

    async getContas() {
        // Fetch store bank accounts
        const { ContaBancariaLoja } = require('../../models');
        return await ContaBancariaLoja.findAll();
    }
}

module.exports = new FinanceiroService();
